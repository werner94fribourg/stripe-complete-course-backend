import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { StripeService } from '../stripe/stripe.service';
import { UsersService } from '../users/users.service';
import Stripe from 'stripe';

export interface PaymentMethodSummary {
  id: string;
  type: string;
  isDefault: boolean;
  card?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
  paypal?: {
    payerEmail: string;
  };
  link?: {
    email: string;
  };
  twint?: Record<string, unknown>;
  createdAt: number;
}

@Injectable()
export class PaymentMethodsService {
  constructor(
    private readonly stripeService: StripeService,
    private readonly usersService: UsersService,
  ) {}

  async ensureStripeCustomer(userId: string): Promise<string> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }

    if (user.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    const customer = await this.stripeService.createCustomer(
      user.email,
      user.username,
      { userId },
    );

    await this.usersService.setStripeCustomerId(userId, customer.id);
    return customer.id;
  }

  async createSetupIntent(userId: string): Promise<{ clientSecret: string }> {
    const customerId = await this.ensureStripeCustomer(userId);
    const setupIntent = await this.stripeService.createSetupIntent(customerId);
    return { clientSecret: setupIntent.client_secret! };
  }

  async listPaymentMethods(userId: string): Promise<PaymentMethodSummary[]> {
    const user = await this.usersService.findById(userId);
    if (!user?.stripeCustomerId) {
      return [];
    }

    const customer = await this.stripeService.getCustomer(
      user.stripeCustomerId,
    );
    if ('deleted' in customer && customer.deleted) {
      return [];
    }

    const defaultPaymentMethodId =
      customer.invoice_settings?.default_payment_method;
    const paymentMethods = await this.stripeService.listPaymentMethods(
      user.stripeCustomerId,
    );

    return paymentMethods.map((pm) =>
      this.formatPaymentMethod(pm, defaultPaymentMethodId as string),
    );
  }

  async deletePaymentMethod(
    userId: string,
    paymentMethodId: string,
  ): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user?.stripeCustomerId) {
      throw new BadRequestException('User has no Stripe customer');
    }

    const paymentMethod =
      await this.stripeService.getPaymentMethod(paymentMethodId);
    if (paymentMethod.customer !== user.stripeCustomerId) {
      throw new BadRequestException(
        'Payment method does not belong to this user',
      );
    }

    await this.stripeService.detachPaymentMethod(paymentMethodId);
  }

  async setDefaultPaymentMethod(
    userId: string,
    paymentMethodId: string,
  ): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user?.stripeCustomerId) {
      throw new BadRequestException('User has no Stripe customer');
    }

    const paymentMethod =
      await this.stripeService.getPaymentMethod(paymentMethodId);
    if (paymentMethod.customer !== user.stripeCustomerId) {
      throw new BadRequestException(
        'Payment method does not belong to this user',
      );
    }

    await this.stripeService.setDefaultPaymentMethod(
      user.stripeCustomerId,
      paymentMethodId,
    );
  }

  private formatPaymentMethod(
    pm: Stripe.PaymentMethod,
    defaultPaymentMethodId?: string,
  ): PaymentMethodSummary {
    const base: PaymentMethodSummary = {
      id: pm.id,
      type: pm.type,
      isDefault: pm.id === defaultPaymentMethodId,
      createdAt: pm.created,
    };

    if (pm.type === 'card' && pm.card) {
      base.card = {
        brand: pm.card.brand,
        last4: pm.card.last4,
        expMonth: pm.card.exp_month,
        expYear: pm.card.exp_year,
      };
    }

    if (pm.type === 'paypal' && pm.paypal) {
      base.paypal = {
        payerEmail: pm.paypal.payer_email || 'Unknown',
      };
    }

    if (pm.type === 'twint') {
      base.twint = {};
    }

    if (pm.type === 'link' && pm.link) {
      base.link = {
        email: pm.link.email || 'Unknown',
      };
    }

    return base;
  }
}
