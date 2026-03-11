import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { StripeModule } from '../stripe/stripe.module';
import { ConfigModule } from '@nestjs/config';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [StripeModule, ConfigModule, OrdersModule],
  controllers: [WebhooksController],
})
export class WebhooksModule {}
