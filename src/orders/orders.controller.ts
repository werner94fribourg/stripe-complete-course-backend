import { Body, Controller, Post } from '@nestjs/common';
import { CreateOrderDto } from './dtos/create-order.dto';
import { OrdersService } from './orders.service';
import { StripeService } from '../stripe/stripe.service';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly ordersService: OrdersService,
  ) {}
  @Post('payment-intent')
  async createPaymentIntent(@Body() dto: CreateOrderDto) {
    const { orderId, userId, items } = dto;
    const amount = this.ordersService.calculateOrderTotal(items);

    const paymentIntent = await this.stripeService.getPaymentIntent(
      amount,
      orderId,
      userId,
    );

    return { clientSecret: paymentIntent.client_secret };
  }
}
