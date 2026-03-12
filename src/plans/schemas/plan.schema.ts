import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import Stripe from 'stripe';

export type PlanDocument = HydratedDocument<Plan>;

@Schema({ timestamps: true })
export class Plan {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  @Prop({ required: true })
  recurring_interval: Stripe.PriceCreateParams.Recurring.Interval;

  @Prop({ required: true })
  unit_amount: number;

  @Prop({ required: true })
  lookup_key: string;

  @Prop({ required: true })
  stripePriceId: string;
}

export const PlanSchema = SchemaFactory.createForClass(Plan);

PlanSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (
    _,
    ret: {
      _id?: { toString(): string };
      id?: string;
      productId?: { toString(): string };
    },
  ) {
    if (ret._id) {
      ret.id = ret._id.toString();
      delete ret._id;
    }
    if (ret.productId) {
      ret.productId = ret.productId.toString() as unknown as {
        toString(): string;
      };
    }
    return ret;
  },
});
