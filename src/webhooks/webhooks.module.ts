import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { StripeModule } from '../stripe/stripe.module';
import { ConfigModule } from '@nestjs/config';
import { OrdersModule } from '../orders/orders.module';
import { SubscriptionModule } from '../subscription/subscription.module';

@Module({
  imports: [StripeModule, ConfigModule, OrdersModule, SubscriptionModule],
  controllers: [WebhooksController],
})
export class WebhooksModule {}
