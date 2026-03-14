import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import Stripe from 'stripe';
import {
  Subscription,
  SubscriptionDocument,
} from './schemas/subscription.schema';
import { CreateSubscriptionDto } from './dtos/create-subscription.dto';
import { ProductsService } from '../products/products.service';
import { PlansService } from '../plans/plans.service';
import { UsersService } from '../users/users.service';
import { StripeService } from '../stripe/stripe.service';

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<Subscription>,
    private readonly productsService: ProductsService,
    private readonly plansService: PlansService,
    private readonly usersService: UsersService,
    private readonly stripeService: StripeService,
  ) {}

  async findByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<SubscriptionDocument | null> {
    return this.subscriptionModel.findOne({ idempotencyKey }).exec();
  }

  async createSubscription(
    userId: string,
    dto: CreateSubscriptionDto,
  ): Promise<{
    subscription: SubscriptionDocument;
    clientSecret: string | null;
  }> {
    // Check for existing subscription with this idempotency key
    if (dto.idempotencyKey) {
      const existingSubscription = await this.findByIdempotencyKey(
        dto.idempotencyKey,
      );
      if (existingSubscription) {
        // Return existing subscription - extract client secret if available
        // Note: client secret may no longer be valid, but returning existing sub prevents duplicates
        return { subscription: existingSubscription, clientSecret: null };
      }
    }

    // 1. Retrieve and validate product exists
    await this.productsService.findOne(dto.productId);

    // 2. Retrieve and validate plan
    const plan = await this.plansService.findOne(dto.planId);

    // Verify plan belongs to the product
    if (plan.productId.toString() !== dto.productId) {
      throw new BadRequestException(
        'Plan does not belong to the specified product',
      );
    }

    // 3. Get or create Stripe customer
    const stripeCustomerId = await this.ensureStripeCustomer(userId);

    // 4. Calculate dates
    const startDate = new Date(dto.startDate);
    const endDate = dto.endDate ? new Date(dto.endDate) : null;
    const now = new Date();

    // Only set billing cycle anchor if start date is in the future
    const billingCycleAnchor =
      startDate > now ? Math.floor(startDate.getTime() / 1000) : undefined;
    const cancelAt = endDate ? Math.floor(endDate.getTime() / 1000) : undefined;

    // 5. Create Stripe subscription
    const stripeSubscription: Stripe.Subscription =
      await this.stripeService.createSubscription(
        stripeCustomerId,
        plan.stripePriceId,
        {
          userId,
          productId: dto.productId,
          planId: dto.planId,
        },
        {
          trialPeriodDays: dto.trialPeriodDays,
          billingCycleAnchor,
          cancelAt,
        },
        dto.idempotencyKey,
      );

    // 6. Extract client secret for payment
    let clientSecret: string | null = null;
    const stripeSub = stripeSubscription as unknown as {
      latest_invoice?: {
        payment_intent?: { client_secret?: string | null };
      };
      current_period_start?: number;
      current_period_end?: number;
      status: string;
      id: string;
    };
    if (stripeSub.latest_invoice?.payment_intent?.client_secret) {
      clientSecret = stripeSub.latest_invoice.payment_intent.client_secret;
    }

    // 7. Calculate trial end date if applicable
    let trialEndDate: Date | null = null;
    if (dto.trialPeriodDays) {
      trialEndDate = new Date(startDate);
      trialEndDate.setDate(trialEndDate.getDate() + dto.trialPeriodDays);
    }

    // 8. Create subscription in database with status: 'incomplete', paid: false
    const subscription = new this.subscriptionModel({
      userId: new Types.ObjectId(userId),
      productId: new Types.ObjectId(dto.productId),
      planId: new Types.ObjectId(dto.planId),
      stripeSubscriptionId: stripeSub.id,
      startDate,
      endDate,
      trialPeriodDays: dto.trialPeriodDays || null,
      trialEndDate,
      currentPeriodStart: stripeSub.current_period_start
        ? new Date(stripeSub.current_period_start * 1000)
        : null,
      currentPeriodEnd: stripeSub.current_period_end
        ? new Date(stripeSub.current_period_end * 1000)
        : null,
      paid: false,
      status: stripeSub.status,
      idempotencyKey: dto.idempotencyKey || null,
    });

    const savedSubscription = await subscription.save();

    return { subscription: savedSubscription, clientSecret };
  }

  private async ensureStripeCustomer(userId: string): Promise<string> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }

    const { email, username, stripeCustomerId } = user;

    if (stripeCustomerId) {
      return stripeCustomerId;
    }

    const customer = await this.stripeService.createCustomer(email, username, {
      userId,
    });

    await this.usersService.setStripeCustomerId(userId, customer.id);

    return customer.id;
  }

  // === Webhook update methods ===

  async markAsPaid(
    stripeSubscriptionId: string,
  ): Promise<SubscriptionDocument> {
    const subscription =
      await this.findByStripeSubscriptionId(stripeSubscriptionId);
    subscription.paid = true;
    subscription.status = 'active';
    return subscription.save();
  }

  async markAsCancelled(
    stripeSubscriptionId: string,
    reason?: string,
  ): Promise<SubscriptionDocument> {
    const subscription =
      await this.findByStripeSubscriptionId(stripeSubscriptionId);
    subscription.status = 'canceled';
    subscription.cancelledAt = new Date();
    if (reason) {
      subscription.cancelReason = reason;
    }
    return subscription.save();
  }

  async updateStatus(
    stripeSubscriptionId: string,
    status: string,
  ): Promise<SubscriptionDocument> {
    const subscription =
      await this.findByStripeSubscriptionId(stripeSubscriptionId);
    subscription.status = status;

    // Update paid based on status
    if (status === 'active') {
      subscription.paid = true;
    } else if (status === 'past_due' || status === 'unpaid') {
      subscription.paid = false;
    }

    return subscription.save();
  }

  async updatePeriod(
    stripeSubscriptionId: string,
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
  ): Promise<SubscriptionDocument> {
    const subscription =
      await this.findByStripeSubscriptionId(stripeSubscriptionId);
    subscription.currentPeriodStart = currentPeriodStart;
    subscription.currentPeriodEnd = currentPeriodEnd;
    return subscription.save();
  }

  // === Query methods ===

  async findByStripeSubscriptionId(
    stripeSubscriptionId: string,
  ): Promise<SubscriptionDocument> {
    const subscription = await this.subscriptionModel
      .findOne({ stripeSubscriptionId })
      .exec();
    if (!subscription) {
      throw new NotFoundException(
        `Subscription with Stripe ID ${stripeSubscriptionId} not found`,
      );
    }
    return subscription;
  }

  async findByUserId(userId: string): Promise<SubscriptionDocument[]> {
    return this.subscriptionModel
      .find({ userId: new Types.ObjectId(userId) })
      .exec();
  }

  async findActiveByUserId(userId: string): Promise<SubscriptionDocument[]> {
    return this.subscriptionModel
      .find({
        userId: new Types.ObjectId(userId),
        status: { $in: ['active', 'trialing'] },
      })
      .exec();
  }

  async findOne(id: string): Promise<SubscriptionDocument> {
    const subscription = await this.subscriptionModel.findById(id).exec();
    if (!subscription) {
      throw new NotFoundException(`Subscription with id ${id} not found`);
    }
    return subscription;
  }

  async cancelSubscription(
    id: string,
    immediately: boolean = false,
  ): Promise<SubscriptionDocument> {
    const subscription = await this.findOne(id);

    await this.stripeService.cancelSubscription(
      subscription.stripeSubscriptionId,
      immediately,
    );

    if (immediately) {
      subscription.status = 'canceled';
      subscription.cancelledAt = new Date();
    }
    // If not immediate, webhook will handle the update when period ends

    return subscription.save();
  }
}
