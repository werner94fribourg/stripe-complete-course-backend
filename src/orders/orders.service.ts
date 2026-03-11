import { Injectable, NotFoundException } from '@nestjs/common';
import { ProductsService } from '../products/products.service';
import { OrderItemDto } from './dtos/order-item.dto';
import { Order } from './entities/order.entity';

@Injectable()
export class OrdersService {
  private orders: Order[] = [];

  constructor(private readonly productsService: ProductsService) {}

  calculateOrderTotal(items: OrderItemDto[]): number {
    let total = 0;

    for (const item of items) {
      const product = this.productsService.findOne(item.productId);
      total += product.price * item.quantity;
    }

    return total;
  }

  create(orderId: string, userId: string, items: OrderItemDto[]): Order {
    const total = Math.round(this.calculateOrderTotal(items) * 100) / 100;

    const order: Order = {
      id: orderId,
      userId,
      items,
      total,
      pending: true,
      isFailed: false,
      createdAt: new Date(),
    };

    this.orders.push(order);
    return order;
  }

  findOne(id: string): Order {
    const order = this.orders.find((o) => o.id === id);
    if (!order) {
      throw new NotFoundException(`Order with id ${id} not found`);
    }
    return order;
  }

  setPaymentIntentId(orderId: string, paymentIntentId: string): Order {
    const order = this.findOne(orderId);
    order.paymentIntentId = paymentIntentId;
    return order;
  }

  markAsCompleted(id: string): Order {
    const order = this.findOne(id);
    order.pending = false;
    return order;
  }

  markAsFailed(id: string): Order {
    const order = this.findOne(id);
    order.isFailed = true;
    return order;
  }

  findAll(): Order[] {
    return this.orders;
  }
}
