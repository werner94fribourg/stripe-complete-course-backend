import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { StripeModule } from 'src/stripe/stripe.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [StripeModule, ConfigModule],
  controllers: [WebhooksController],
})
export class WebhooksModule {}
