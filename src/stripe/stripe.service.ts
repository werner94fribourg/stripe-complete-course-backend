import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderItemDto } from '../orders/dtos/order-item.dto';
import { ProductsService } from '../products/products.service';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  constructor(
    private readonly client: Stripe,
    private readonly configService: ConfigService,
    private readonly productsService: ProductsService,
  ) {}

  constructWebhookEvent(
    payload: Buffer,
    signature: string,
    secret: string,
  ): Stripe.Event {
    return this.client.webhooks.constructEvent(payload, signature, secret);
  }

  async getPaymentIntent(amount: number, orderId: string, userId: string) {
    const paymentIntent = await this.client.paymentIntents.create({
      amount: Math.round(amount),
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        orderId,
        userId,
      },
    });

    return {
      ...paymentIntent,
      amount: Math.round(paymentIntent.amount) / 100,
    };
  }

  async getCheckoutSession(
    orderId: string,
    userId: string,
    items: OrderItemDto[],
  ) {
    const lineItems = items.map((item) => {
      const product = this.productsService.findOne(item.productId);
      return {
        price_data: {
          currency: 'usd',
          product_data: {
            name: product.name,
            description: product.description,
          },
          unit_amount: Math.round(product.price),
        },
        quantity: item.quantity,
      };
    });

    const session = await this.client.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      success_url: `${this.configService.get<string>('FRONTEND_URL')}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.configService.get<string>('FRONTEND_URL')}/checkout/cancel`,
      metadata: { orderId, userId },
    });

    return {
      ...session,
      amount_total: session.amount_total
        ? Math.round(session.amount_total) / 100
        : null,
    };
  }

  async createRefund(
    paymentIntentId: string,
    amount?: number,
  ): Promise<Stripe.Refund> {
    const refundParams: Stripe.RefundCreateParams = {
      payment_intent: paymentIntentId,
    };

    if (amount !== undefined) {
      refundParams.amount = Math.round(amount * 100);
    }

    return this.client.refunds.create(refundParams);
  }
}
