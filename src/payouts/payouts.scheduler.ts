import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PayoutsService } from './payouts.service';

@Injectable()
export class PayoutsScheduler {
  private readonly logger = new Logger(PayoutsScheduler.name);

  constructor(private readonly payoutsService: PayoutsService) {}

  @Cron('0 0 1 * *')
  async handleMonthlyPayouts() {
    this.logger.log('Starting monthly payout cron job...');
    try {
      await this.payoutsService.processMonthlyPayouts();
      this.logger.log('Monthly payout cron job completed successfully');
    } catch (error) {
      this.logger.error('Monthly payout cron job failed:', error);
    }
  }
}
