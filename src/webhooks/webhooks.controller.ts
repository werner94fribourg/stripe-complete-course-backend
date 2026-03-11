import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  RawBody,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StripeService } from '../stripe/stripe.service';
import { OrdersService } from '../orders/orders.service';
import Stripe from 'stripe';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name, {
    timestamp: true,
  });

  constructor(
    private readonly stripe: StripeService,
    private readonly configService: ConfigService,
    private readonly ordersService: OrdersService,
  ) {}

  @Post('')
  @HttpCode(200)
  handleStripeWebhook(
    @Headers('stripe-signature') signature: string,
    @RawBody() payload: Buffer,
  ) {
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );

    let event: Stripe.Event;

    try {
      if (webhookSecret) {
        // Production mode: verify signature
        event = this.stripe.constructWebhookEvent(
          payload,
          signature,
          webhookSecret,
        );
      } else {
        // Local testing mode: parse event without signature verification
        this.logger.warn(
          'STRIPE_WEBHOOK_SECRET not set - skipping signature verification (local testing mode)',
        );
        event = JSON.parse(payload.toString()) as Stripe.Event;
      }

      switch (event.type) {
        case 'payment_intent.succeeded':
          return this.handlePaymentSucceeded(event.data.object);
        case 'payment_intent.payment_failed':
          return this.handlePaymentFailed(event.data.object);
        default:
          this.logger.log(`Unhandled event type: ${event.type}`);
      }

      return { received: true };
    } catch (err) {
      throw new BadRequestException(
        `Webhook Error: ${(err as { message: string })?.message}`,
      );
    }
  }

  private handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    this.logger.log(`Payment succeeded for PaymentIntent: ${paymentIntent.id}`);

    const orderId = paymentIntent.metadata?.orderId;

    if (orderId) {
      const order = this.ordersService.markAsCompleted(orderId);
      this.logger.log(`Order ${orderId} marked as completed (pending: false)`);

      return {
        received: true,
        type: 'payment_intent.succeeded',
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        order,
      };
    }

    return {
      received: true,
      type: 'payment_intent.succeeded',
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
    };
  }

  private handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
    this.logger.log(`Payment failed for PaymentIntent: ${paymentIntent.id}`);

    const orderId = paymentIntent.metadata?.orderId;

    if (orderId) {
      const order = this.ordersService.markAsFailed(orderId);
      this.logger.log(`Order ${orderId} marked as failed (isFailed: true)`);

      return {
        received: true,
        type: 'payment_intent.payment_failed',
        paymentIntentId: paymentIntent.id,
        order,
      };
    }

    return {
      received: true,
      type: 'payment_intent.payment_failed',
      paymentIntentId: paymentIntent.id,
    };
  }
}
