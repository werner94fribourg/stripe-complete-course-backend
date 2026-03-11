import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { StripeModule } from './stripe/stripe.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [StripeModule, WebhooksModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
