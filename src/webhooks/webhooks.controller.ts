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
import { SubscriptionService } from '../subscription/subscription.service';
import Stripe from 'stripe';

// Type helpers for Stripe objects (to work around @types/stripe conflicts)
interface StripeInvoice {
  id: string;
  subscription?: string | { id: string };
}

interface StripeSubscription {
  id: string;
  status: string;
  current_period_start: number;
  current_period_end: number;
  cancellation_details?: { reason?: string };
}

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name, {
    timestamp: true,
  });

  constructor(
    private readonly stripe: StripeService,
    private readonly configService: ConfigService,
    private readonly ordersService: OrdersService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  @Post('')
  @HttpCode(200)
  async handleStripeWebhook(
    @Headers('stripe-signature') signature: string,
    @RawBody() payload: Buffer,
  ) {
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );

    let event: Stripe.Event;

    try {
      if (webhookSecret) {
        event = this.stripe.constructWebhookEvent(
          payload,
          signature,
          webhookSecret,
        );
      } else {
        this.logger.warn(
          'STRIPE_WEBHOOK_SECRET not set - skipping signature verification (local testing mode)',
        );
        event = JSON.parse(payload.toString()) as Stripe.Event;
      }

      switch (event.type) {
        case 'payment_intent.succeeded':
          return await this.handlePaymentSucceeded(event.data.object);
        case 'payment_intent.payment_failed':
          return await this.handlePaymentFailed(event.data.object);
        case 'invoice.payment_succeeded':
          return await this.handleInvoicePaymentSucceeded(
            event.data.object as unknown as StripeInvoice,
          );
        case 'invoice.payment_failed':
          return await this.handleInvoicePaymentFailed(
            event.data.object as unknown as StripeInvoice,
          );
        case 'customer.subscription.updated':
          return await this.handleSubscriptionUpdated(
            event.data.object as unknown as StripeSubscription,
          );
        case 'customer.subscription.deleted':
          return await this.handleSubscriptionDeleted(
            event.data.object as unknown as StripeSubscription,
          );
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

  private async handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    this.logger.log(`Payment succeeded for PaymentIntent: ${paymentIntent.id}`);

    const orderId = paymentIntent.metadata?.orderId;

    if (orderId) {
      await this.ordersService.setPaymentIntentId(orderId, paymentIntent.id);
      const order = await this.ordersService.markAsCompleted(orderId);
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

  private async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
    this.logger.log(`Payment failed for PaymentIntent: ${paymentIntent.id}`);

    const orderId = paymentIntent.metadata?.orderId;

    if (orderId) {
      const order = await this.ordersService.markAsFailed(orderId);
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

  private async handleInvoicePaymentSucceeded(invoice: StripeInvoice) {
    this.logger.log(`Invoice payment succeeded: ${invoice.id}`);

    // Only process subscription invoices
    if (invoice.subscription) {
      const subscriptionId =
        typeof invoice.subscription === 'string'
          ? invoice.subscription
          : invoice.subscription.id;

      try {
        await this.subscriptionService.markAsPaid(subscriptionId);
        this.logger.log(`Subscription ${subscriptionId} marked as paid`);

        return {
          received: true,
          type: 'invoice.payment_succeeded',
          invoiceId: invoice.id,
          subscriptionId,
        };
      } catch {
        this.logger.warn(
          `Subscription ${subscriptionId} not found in database`,
        );
      }
    }

    return {
      received: true,
      type: 'invoice.payment_succeeded',
      invoiceId: invoice.id,
    };
  }

  private async handleInvoicePaymentFailed(invoice: StripeInvoice) {
    this.logger.log(`Invoice payment failed: ${invoice.id}`);

    if (invoice.subscription) {
      const subscriptionId =
        typeof invoice.subscription === 'string'
          ? invoice.subscription
          : invoice.subscription.id;

      try {
        await this.subscriptionService.updateStatus(subscriptionId, 'past_due');
        this.logger.log(`Subscription ${subscriptionId} marked as past_due`);
      } catch {
        this.logger.warn(
          `Subscription ${subscriptionId} not found in database`,
        );
      }
    }

    return {
      received: true,
      type: 'invoice.payment_failed',
      invoiceId: invoice.id,
    };
  }

  private async handleSubscriptionUpdated(subscription: StripeSubscription) {
    this.logger.log(
      `Subscription updated: ${subscription.id}, status: ${subscription.status}`,
    );

    try {
      // Update status in database
      await this.subscriptionService.updateStatus(
        subscription.id,
        subscription.status,
      );

      // Update billing period
      await this.subscriptionService.updatePeriod(
        subscription.id,
        new Date(subscription.current_period_start * 1000),
        new Date(subscription.current_period_end * 1000),
      );

      this.logger.log(`Subscription ${subscription.id} updated in database`);
    } catch {
      this.logger.warn(`Subscription ${subscription.id} not found in database`);
    }

    return {
      received: true,
      type: 'customer.subscription.updated',
      subscriptionId: subscription.id,
      status: subscription.status,
    };
  }

  private async handleSubscriptionDeleted(subscription: StripeSubscription) {
    this.logger.log(`Subscription deleted/cancelled: ${subscription.id}`);

    try {
      const cancellationReason =
        subscription.cancellation_details?.reason || undefined;
      await this.subscriptionService.markAsCancelled(
        subscription.id,
        cancellationReason,
      );

      this.logger.log(`Subscription ${subscription.id} marked as cancelled`);
    } catch {
      this.logger.warn(`Subscription ${subscription.id} not found in database`);
    }

    return {
      received: true,
      type: 'customer.subscription.deleted',
      subscriptionId: subscription.id,
    };
  }
}
