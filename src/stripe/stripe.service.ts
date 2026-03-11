import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  constructor(private readonly client: Stripe) {}

  constructWebhookEvent(
    payload: Buffer,
    signature: string,
    secret: string,
  ): Stripe.Event {
    return this.client.webhooks.constructEvent(payload, signature, secret);
  }
}
