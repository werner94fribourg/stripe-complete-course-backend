import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ _id: false })
export class OrderItem {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ required: true })
  priceAtPurchase: number;

  @Prop({ required: true })
  stripePriceId: string;
}

export const OrderItemSchema = SchemaFactory.createForClass(OrderItem);

export type OrderDocument = HydratedDocument<Order>;

@Schema({ timestamps: true })
export class Order {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: [OrderItemSchema], required: true })
  items: OrderItem[];

  @Prop({ required: true })
  total: number;

  @Prop({ default: true })
  pending: boolean;

  @Prop({ default: false })
  isFailed: boolean;

  @Prop({ type: String, default: null })
  paymentIntentId: string | null;

  @Prop({ type: String, default: null })
  checkoutSessionId: string | null;

  @Prop({ type: String, default: null })
  stripeCustomerId: string | null;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

OrderSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (
    _,
    ret: {
      _id?: { toString(): string };
      id?: string;
      userId?: { toString(): string };
      items?: Array<{ productId?: { toString(): string } }>;
    },
  ) {
    if (ret._id) {
      ret.id = ret._id.toString();
      delete ret._id;
    }
    if (ret.userId) {
      ret.userId = ret.userId.toString() as unknown as { toString(): string };
    }
    if (ret.items) {
      ret.items = ret.items.map((item) => ({
        ...item,
        productId: item.productId?.toString() as unknown as {
          toString(): string;
        },
      }));
    }
    return ret;
  },
});
