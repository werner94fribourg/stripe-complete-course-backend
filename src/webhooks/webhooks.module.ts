import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { StripeModule } from '../stripe/stripe.module';
import { ConfigModule } from '@nestjs/config';
import { OrdersModule } from '../orders/orders.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { SellerEarningsModule } from '../seller-earnings/seller-earnings.module';
import { PayoutsModule } from '../payouts/payouts.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    StripeModule,
    ConfigModule,
    OrdersModule,
    SubscriptionModule,
    SellerEarningsModule,
    PayoutsModule,
    UsersModule,
  ],
  controllers: [WebhooksController],
})
export class WebhooksModule {}
