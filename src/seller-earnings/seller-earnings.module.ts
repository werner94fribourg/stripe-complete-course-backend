import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SellerEarningsController } from './seller-earnings.controller';
import { SellerEarningsService } from './seller-earnings.service';
import {
  SellerEarnings,
  SellerEarningsSchema,
} from './schemas/seller-earnings.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SellerEarnings.name, schema: SellerEarningsSchema },
    ]),
  ],
  controllers: [SellerEarningsController],
  providers: [SellerEarningsService],
  exports: [SellerEarningsService],
})
export class SellerEarningsModule {}
