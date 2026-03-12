import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type SubscriptionDocument = HydratedDocument<Subscription>;

@Schema({ timestamps: true })
export class Subscription {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Plan', required: true })
  planId: Types.ObjectId;

  @Prop({ required: true })
  stripeSubscriptionId: string;

  @Prop({ required: true })
  startDate: Date;

  @Prop({ type: Date, default: null })
  endDate: Date | null;

  @Prop({ type: Number, default: null })
  trialPeriodDays: number | null;

  @Prop({ type: Date, default: null })
  trialEndDate: Date | null;

  @Prop({ type: Date, default: null })
  currentPeriodStart: Date | null;

  @Prop({ type: Date, default: null })
  currentPeriodEnd: Date | null;

  @Prop({ default: false })
  paid: boolean;

  @Prop({
    type: String,
    enum: [
      'incomplete',
      'incomplete_expired',
      'trialing',
      'active',
      'past_due',
      'canceled',
      'unpaid',
      'paused',
    ],
    default: 'incomplete',
  })
  status: string;

  @Prop({ type: String, default: null })
  cancelReason: string | null;

  @Prop({ type: Date, default: null })
  cancelledAt: Date | null;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);

SubscriptionSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (
    _,
    ret: {
      _id?: { toString(): string };
      id?: string;
      userId?: { toString(): string };
      productId?: { toString(): string };
      planId?: { toString(): string };
    },
  ) {
    if (ret._id) {
      ret.id = ret._id.toString();
      delete ret._id;
    }
    if (ret.userId) {
      ret.userId = ret.userId.toString() as unknown as { toString(): string };
    }
    if (ret.productId) {
      ret.productId = ret.productId.toString() as unknown as {
        toString(): string;
      };
    }
    if (ret.planId) {
      ret.planId = ret.planId.toString() as unknown as { toString(): string };
    }
    return ret;
  },
});
