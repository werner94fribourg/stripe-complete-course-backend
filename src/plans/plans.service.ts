import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Plan, PlanDocument } from './schemas/plan.schema';
import { CreatePlansDto } from './dtos/create-plans.dto';
import { ProductsService } from '../products/products.service';
import { StripeService } from '../stripe/stripe.service';

@Injectable()
export class PlansService {
  constructor(
    @InjectModel(Plan.name) private planModel: Model<Plan>,
    private readonly productsService: ProductsService,
    private readonly stripeService: StripeService,
  ) {}

  async createPlan(dto: CreatePlansDto): Promise<PlanDocument[]> {
    const { productId, ranges } = dto;

    // Validate product exists and get stripeProductId
    // ProductsService.findOne throws NotFoundException if not found
    const product = await this.productsService.findOne(productId);
    const { stripeProductId } = product;

    // Create Stripe prices and Plan records for each range
    const createdPlans: PlanDocument[] = [];

    for (const range of ranges) {
      // Create recurring price in Stripe
      const stripePrice = await this.stripeService.createRecurringPrice(
        stripeProductId,
        range.unit_amount,
        range.recurring_interval,
        'usd',
      );

      // Create plan record in database
      const plan = new this.planModel({
        productId: product._id,
        recurring_interval: range.recurring_interval,
        unit_amount: range.unit_amount,
        lookup_key: range.lookup_key,
        stripePriceId: stripePrice.id,
      });

      const savedPlan = await plan.save();
      createdPlans.push(savedPlan);
    }

    return createdPlans;
  }

  async findAll(): Promise<PlanDocument[]> {
    return this.planModel.find().exec();
  }

  async findByProductId(productId: string): Promise<PlanDocument[]> {
    return this.planModel.find({ productId }).exec();
  }

  async findOne(id: string): Promise<PlanDocument> {
    const plan = await this.planModel.findById(id).exec();
    if (!plan) {
      throw new NotFoundException(`Plan with id ${id} not found`);
    }
    return plan;
  }

  async findByLookupKey(lookupKey: string): Promise<PlanDocument | null> {
    return this.planModel.findOne({ lookup_key: lookupKey }).exec();
  }
}
