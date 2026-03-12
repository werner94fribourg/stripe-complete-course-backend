import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';
import { Plan, PlanSchema } from './schemas/plan.schema';
import { StripeModule } from '../stripe/stripe.module';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Plan.name, schema: PlanSchema }]),
    StripeModule,
    ProductsModule,
  ],
  controllers: [PlansController],
  providers: [PlansService],
  exports: [PlansService],
})
export class PlansModule {}
