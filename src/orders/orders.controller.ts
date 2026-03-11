import { Body, Controller, Get, Post } from '@nestjs/common';
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

    // Create and store the order with pending: true
    const order = this.ordersService.create(orderId, userId, items);

    const paymentIntent = await this.stripeService.getPaymentIntent(
      order.total,
      orderId,
      userId,
    );

    return { clientSecret: paymentIntent.client_secret, order };
  }

  @Get()
  findAll() {
    return this.ordersService.findAll();
  }
}
