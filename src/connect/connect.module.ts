import { Module } from '@nestjs/common';
import { ConnectController } from './connect.controller';
import { ConnectService } from './connect.service';
import { StripeModule } from '../stripe/stripe.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [StripeModule, UsersModule],
  controllers: [ConnectController],
  providers: [ConnectService],
  exports: [ConnectService],
})
export class ConnectModule {}
