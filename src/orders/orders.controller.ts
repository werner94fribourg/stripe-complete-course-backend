import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { CreateOrderDto } from './dtos/create-order.dto';
import { RefundDto } from './dtos/refund.dto';
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

  @Post('checkout-session')
  async createCheckoutSession(@Body() dto: CreateOrderDto) {
    const { orderId, userId, items } = dto;

    // Create and store the order with pending: true
    const order = this.ordersService.create(orderId, userId, items);

    const session = await this.stripeService.getCheckoutSession(
      orderId,
      userId,
      items,
    );

    return { url: session.url, sessionId: session.id, order };
  }

  @Post(':id/refund')
  async refundOrder(@Param('id') id: string, @Body() dto: RefundDto) {
    const order = this.ordersService.findOne(id);

    if (!order.paymentIntentId) {
      throw new BadRequestException('Cannot refund: no payment associated');
    }

    if (order.pending) {
      throw new BadRequestException('Cannot refund: payment still pending');
    }

    if (order.isFailed) {
      throw new BadRequestException('Cannot refund: payment failed');
    }

    const refund = await this.stripeService.createRefund(
      order.paymentIntentId,
      dto.amount,
    );

    return {
      refundId: refund.id,
      amount: refund.amount / 100,
      status: refund.status,
      orderId: order.id,
    };
  }
}
