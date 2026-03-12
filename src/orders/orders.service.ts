import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ProductsService } from '../products/products.service';
import { OrderItemDto } from './dtos/order-item.dto';
import { Order, OrderDocument, OrderItem } from './schemas/order.schema';

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<Order>,
    private readonly productsService: ProductsService,
  ) {}

  async calculateOrderTotal(items: OrderItemDto[]): Promise<number> {
    let total = 0;

    for (const item of items) {
      const product = await this.productsService.findOne(item.productId);
      total += product.price * item.quantity;
    }

    return total;
  }

  async create(
    userId: string,
    items: OrderItemDto[],
    stripeCustomerId?: string,
  ): Promise<OrderDocument> {
    const orderItems: OrderItem[] = [];
    let total = 0;

    for (const item of items) {
      const product = await this.productsService.findOne(item.productId);
      const itemTotal = product.price * item.quantity;
      total += itemTotal;

      orderItems.push({
        productId: new Types.ObjectId(item.productId),
        quantity: item.quantity,
        priceAtPurchase: product.price,
        stripePriceId: product.stripePriceId,
      });
    }

    const order = new this.orderModel({
      userId: new Types.ObjectId(userId),
      items: orderItems,
      total: Math.round(total),
      pending: true,
      isFailed: false,
      stripeCustomerId: stripeCustomerId || null,
    });

    return order.save();
  }

  async findOne(id: string): Promise<OrderDocument> {
    const order = await this.orderModel.findById(id).exec();
    if (!order) {
      throw new NotFoundException(`Order with id ${id} not found`);
    }
    return order;
  }

  async findByUserId(userId: string): Promise<OrderDocument[]> {
    return this.orderModel.find({ userId: new Types.ObjectId(userId) }).exec();
  }

  async setPaymentIntentId(
    orderId: string,
    paymentIntentId: string,
  ): Promise<OrderDocument> {
    const order = await this.findOne(orderId);
    order.paymentIntentId = paymentIntentId;
    return order.save();
  }

  async setCheckoutSessionId(
    orderId: string,
    checkoutSessionId: string,
  ): Promise<OrderDocument> {
    const order = await this.findOne(orderId);
    order.checkoutSessionId = checkoutSessionId;
    return order.save();
  }

  async markAsCompleted(id: string): Promise<OrderDocument> {
    const order = await this.findOne(id);
    order.pending = false;
    return order.save();
  }

  async markAsFailed(id: string): Promise<OrderDocument> {
    const order = await this.findOne(id);
    order.isFailed = true;
    return order.save();
  }

  async findAll(): Promise<OrderDocument[]> {
    return this.orderModel.find().exec();
  }
}
