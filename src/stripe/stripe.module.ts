import { Module } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Module({
  imports: [ConfigModule],
  providers: [
    StripeService,
    {
      provide: Stripe,
      useFactory: (configService: ConfigService) =>
        new Stripe(configService.getOrThrow('STRIPE_SECRET_KEY')),
      inject: [ConfigService],
    },
  ],
  exports: [StripeService],
})
export class StripeModule {}
