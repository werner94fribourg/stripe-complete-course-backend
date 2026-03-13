import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type SellerEarningsDocument = HydratedDocument<SellerEarnings>;

@Schema({ timestamps: true })
export class SellerEarnings {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  sellerId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Order', required: true })
  orderId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  @Prop({ required: true })
  grossAmount: number;

  @Prop({ required: true })
  platformFee: number;

  @Prop({ required: true })
  netAmount: number;

  @Prop({ type: String, required: true })
  paymentIntentId: string;

  @Prop({ type: String, default: null })
  stripeTransferId: string | null;

  @Prop({
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending',
  })
  status: string;

  @Prop({ type: Date, default: null })
  paidAt: Date | null;
}

export const SellerEarningsSchema =
  SchemaFactory.createForClass(SellerEarnings);

SellerEarningsSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (
    _,
    ret: {
      _id?: { toString(): string };
      id?: string;
      sellerId?: { toString(): string };
      orderId?: { toString(): string };
      productId?: { toString(): string };
    },
  ) {
    if (ret._id) {
      ret.id = ret._id.toString();
      delete ret._id;
    }
    if (ret.sellerId) {
      ret.sellerId = ret.sellerId.toString() as unknown as {
        toString(): string;
      };
    }
    if (ret.orderId) {
      ret.orderId = ret.orderId.toString() as unknown as { toString(): string };
    }
    if (ret.productId) {
      ret.productId = ret.productId.toString() as unknown as {
        toString(): string;
      };
    }
    return ret;
  },
});
