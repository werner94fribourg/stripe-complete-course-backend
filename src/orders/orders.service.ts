import { Injectable } from '@nestjs/common';
import { ProductsService } from '../products/products.service';
import { OrderItemDto } from './dtos/order-item.dto';

@Injectable()
export class OrdersService {
  constructor(private readonly productsService: ProductsService) {}

  calculateOrderTotal(items: OrderItemDto[]): number {
    let total = 0;

    for (const item of items) {
      const product = this.productsService.findOne(item.productId);
      total += product.price * item.quantity;
    }

    return total;
  }
}
