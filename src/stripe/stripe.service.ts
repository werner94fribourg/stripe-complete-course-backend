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

  // === SUBSCRIPTION MANAGEMENT ===

  async createSubscription(
    customerId: string,
    priceId: string,
    metadata?: Record<string, string>,
    options?: {
      trialPeriodDays?: number;
      billingCycleAnchor?: number;
      cancelAt?: number;
    },
  ): Promise<Stripe.Subscription> {
    const params: Stripe.SubscriptionCreateParams = {
      customer: customerId,
      items: [{ price: priceId }],
      metadata,
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
    };

    if (options?.trialPeriodDays) {
      params.trial_period_days = options.trialPeriodDays;
    }

    if (options?.billingCycleAnchor) {
      params.billing_cycle_anchor = options.billingCycleAnchor;
    }

    if (options?.cancelAt) {
      params.cancel_at = options.cancelAt;
    }

    return this.client.subscriptions.create(params);
  }

  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return this.client.subscriptions.retrieve(subscriptionId);
  }

  async updateSubscription(
    subscriptionId: string,
    params: Stripe.SubscriptionUpdateParams,
  ): Promise<Stripe.Subscription> {
    return this.client.subscriptions.update(subscriptionId, params);
  }

  async cancelSubscription(
    subscriptionId: string,
    immediately: boolean = false,
  ): Promise<Stripe.Subscription> {
    if (immediately) {
      return this.client.subscriptions.cancel(subscriptionId);
    }
    return this.client.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  }

  // === STRIPE CONNECT (Express Accounts) ===

  async createConnectAccount(
    email: string,
    metadata?: Record<string, string>,
  ): Promise<Stripe.Account> {
    return this.client.accounts.create({
      type: 'express',
      email,
      metadata,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });
  }

  async createAccountLink(
    accountId: string,
    refreshUrl: string,
    returnUrl: string,
  ): Promise<Stripe.AccountLink> {
    return this.client.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });
  }

  async getConnectAccount(accountId: string): Promise<Stripe.Account> {
    return this.client.accounts.retrieve(accountId);
  }

  async isConnectAccountReady(accountId: string): Promise<boolean> {
    const account = await this.getConnectAccount(accountId);
    return account.charges_enabled && account.payouts_enabled;
  }

  // === PAYMENT INTENT WITH CONNECT ===

  async getPaymentIntentWithConnect(
    amount: number,
    orderId: string,
    userId: string,
    connectedAccountId: string,
    applicationFeeAmount: number,
    customerId?: string,
    sellerInfo?: { sellerId: string; productId: string },
  ) {
    const params: Stripe.PaymentIntentCreateParams = {
      amount: Math.round(amount),
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      application_fee_amount: Math.round(applicationFeeAmount),
      transfer_data: {
        destination: connectedAccountId,
      },
      metadata: {
        orderId,
        userId,
        ...(sellerInfo && {
          sellerId: sellerInfo.sellerId,
          productId: sellerInfo.productId,
        }),
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

  // === TRANSFERS ===

  async createTransfer(
    amount: number,
    destinationAccountId: string,
    metadata?: Record<string, string>,
  ): Promise<Stripe.Transfer> {
    return this.client.transfers.create({
      amount: Math.round(amount),
      currency: 'usd',
      destination: destinationAccountId,
      metadata,
    });
  }
}
