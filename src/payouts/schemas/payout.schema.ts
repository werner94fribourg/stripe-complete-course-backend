import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type PayoutDocument = HydratedDocument<Payout>;

@Schema({ timestamps: true })
export class Payout {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  sellerId: Types.ObjectId;

  @Prop({ required: true })
  totalAmount: number;

  @Prop({ type: String, required: true })
  stripeTransferId: string;

  @Prop({
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
  })
  status: string;

  @Prop({ required: true })
  periodStart: Date;

  @Prop({ required: true })
  periodEnd: Date;

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'SellerEarnings' }],
  })
  earningsIds: Types.ObjectId[];
}

export const PayoutSchema = SchemaFactory.createForClass(Payout);

PayoutSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (
    _,
    ret: {
      _id?: { toString(): string };
      id?: string;
      sellerId?: { toString(): string };
      earningsIds?: Array<{ toString(): string }>;
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
    if (ret.earningsIds) {
      ret.earningsIds = ret.earningsIds.map(
        (id) => id.toString() as unknown as { toString(): string },
      );
    }
    return ret;
  },
});
