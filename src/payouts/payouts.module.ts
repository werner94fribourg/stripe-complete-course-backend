import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PayoutsController } from './payouts.controller';
import { PayoutsService } from './payouts.service';
import { PayoutsScheduler } from './payouts.scheduler';
import { Payout, PayoutSchema } from './schemas/payout.schema';
import { SellerEarningsModule } from '../seller-earnings/seller-earnings.module';
import { StripeModule } from '../stripe/stripe.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Payout.name, schema: PayoutSchema }]),
    SellerEarningsModule,
    StripeModule,
    UsersModule,
  ],
  controllers: [PayoutsController],
  providers: [PayoutsService, PayoutsScheduler],
  exports: [PayoutsService],
})
export class PayoutsModule {}
