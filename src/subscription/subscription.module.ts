import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import {
  Subscription,
  SubscriptionSchema,
} from './schemas/subscription.schema';
import { StripeModule } from '../stripe/stripe.module';
import { ProductsModule } from '../products/products.module';
import { PlansModule } from '../plans/plans.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Subscription.name, schema: SubscriptionSchema },
    ]),
    StripeModule,
    ProductsModule,
    PlansModule,
    UsersModule,
  ],
  controllers: [SubscriptionController],
  providers: [SubscriptionService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
