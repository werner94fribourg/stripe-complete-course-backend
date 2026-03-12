import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  constructor(
    private readonly client: Stripe,
    private readonly configService: ConfigService,
  ) {}

  constructWebhookEvent(
    payload: Buffer,
    signature: string,
    secret: string,
  ): Stripe.Event {
    return this.client.webhooks.constructEvent(payload, signature, secret);
  }

  // === CUSTOMER MANAGEMENT ===

  async createCustomer(
    email: string,
    name?: string,
    metadata?: Record<string, string>,
  ): Promise<Stripe.Customer> {
    return this.client.customers.create({
      email,
      name,
      metadata,
    });
  }

  async updateCustomer(
    customerId: string,
    params: Stripe.CustomerUpdateParams,
  ): Promise<Stripe.Customer> {
    return this.client.customers.update(customerId, params);
  }

  async deleteCustomer(customerId: string): Promise<Stripe.DeletedCustomer> {
    return this.client.customers.del(customerId);
  }

  async getCustomer(
    customerId: string,
  ): Promise<Stripe.Customer | Stripe.DeletedCustomer> {
    return this.client.customers.retrieve(customerId);
  }

  // === PRODUCT MANAGEMENT ===

  async createProduct(
    name: string,
    description: string,
    metadata?: Record<string, string>,
  ): Promise<Stripe.Product> {
    return this.client.products.create({
      name,
      description,
      metadata,
    });
  }

  async updateProduct(
    productId: string,
    params: Stripe.ProductUpdateParams,
  ): Promise<Stripe.Product> {
    return this.client.products.update(productId, params);
  }

  async archiveProduct(productId: string): Promise<Stripe.Product> {
    return this.client.products.update(productId, { active: false });
  }

  async getProduct(productId: string): Promise<Stripe.Product> {
    return this.client.products.retrieve(productId);
  }

  // === PRICE MANAGEMENT ===

  async createOneTimePrice(
    productId: string,
    unitAmount: number,
    currency: string = 'usd',
  ): Promise<Stripe.Price> {
    return this.client.prices.create({
      product: productId,
      unit_amount: unitAmount,
      currency,
    });
  }

  async createRecurringPrice(
    productId: string,
    unitAmount: number,
    interval: Stripe.PriceCreateParams.Recurring.Interval = 'month',
    currency: string = 'usd',
  ): Promise<Stripe.Price> {
    return this.client.prices.create({
      product: productId,
      unit_amount: unitAmount,
      currency,
      recurring: { interval },
    });
  }

  async deactivatePrice(priceId: string): Promise<Stripe.Price> {
    return this.client.prices.update(priceId, { active: false });
  }

  async getPrice(priceId: string): Promise<Stripe.Price> {
    return this.client.prices.retrieve(priceId);
  }

  // === PAYMENT INTENT ===

  async getPaymentIntent(
    amount: number,
    orderId: string,
    userId: string,
    customerId?: string,
  ) {
    const params: Stripe.PaymentIntentCreateParams = {
      amount: Math.round(amount),
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        orderId,
        userId,
      },
    };

    if (customerId) {
      params.customer = customerId;
    }

    const paymentIntent = await this.client.paymentIntents.create(params);

    return {
      ...paymentIntent,
      amount: Math.round(paymentIntent.amount) / 100,
    };
  }

  // === CHECKOUT SESSION ===

  async getCheckoutSession(
    orderId: string,
    userId: string,
    lineItems: Array<{ priceId: string; quantity: number }>,
    customerId?: string,
  ) {
    const params: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      line_items: lineItems.map((item) => ({
        price: item.priceId,
        quantity: item.quantity,
      })),
      success_url: `${this.configService.get<string>('FRONTEND_URL')}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.configService.get<string>('FRONTEND_URL')}/checkout/cancel`,
      metadata: { orderId, userId },
    };

    if (customerId) {
      params.customer = customerId;
    }

    const session = await this.client.checkout.sessions.create(params);

    return {
      ...session,
      amount_total: session.amount_total
        ? Math.round(session.amount_total) / 100
        : null,
    };
  }

  // === REFUNDS ===

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
