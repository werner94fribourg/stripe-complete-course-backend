import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Payout, PayoutDocument } from './schemas/payout.schema';
import { SellerEarningsService } from '../seller-earnings/seller-earnings.service';
import { StripeService } from '../stripe/stripe.service';
import { UsersService } from '../users/users.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);
  private readonly minimumPayoutAmount: number;

  constructor(
    @InjectModel(Payout.name) private payoutModel: Model<Payout>,
    private readonly sellerEarningsService: SellerEarningsService,
    private readonly stripeService: StripeService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {
    this.minimumPayoutAmount =
      this.configService.get<number>('MINIMUM_PAYOUT_AMOUNT') || 1000;
  }

  async findOne(id: string): Promise<PayoutDocument> {
    const payout = await this.payoutModel.findById(id).exec();
    if (!payout) {
      throw new NotFoundException(`Payout with id ${id} not found`);
    }
    return payout;
  }

  async findBySeller(sellerId: string): Promise<PayoutDocument[]> {
    return this.payoutModel
      .find({ sellerId: new Types.ObjectId(sellerId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async processMonthlyPayouts(): Promise<void> {
    this.logger.log('Starting monthly payout processing...');

    const pendingEarningsGrouped =
      await this.sellerEarningsService.findAllPendingGroupedBySeller();

    const periodEnd = new Date();
    const periodStart = new Date();
    periodStart.setMonth(periodStart.getMonth() - 1);

    for (const group of pendingEarningsGrouped) {
      const { sellerId, totalAmount, earningIds } = group;

      if (totalAmount < this.minimumPayoutAmount) {
        this.logger.log(
          `Skipping seller ${sellerId}: amount ${totalAmount} below minimum ${this.minimumPayoutAmount}`,
        );
        continue;
      }

      try {
        const user = await this.usersService.findById(sellerId);

        if (!user || !user.stripeConnectAccountId) {
          this.logger.warn(
            `Seller ${sellerId} has no Connect account, skipping payout`,
          );
          continue;
        }

        const isReady = await this.stripeService.isConnectAccountReady(
          user.stripeConnectAccountId,
        );

        if (!isReady) {
          this.logger.warn(
            `Seller ${sellerId} Connect account not ready, skipping payout`,
          );
          continue;
        }

        const transfer = await this.stripeService.createTransfer(
          totalAmount,
          user.stripeConnectAccountId,
          {
            sellerId,
            periodStart: periodStart.toISOString(),
            periodEnd: periodEnd.toISOString(),
          },
        );

        const payout = new this.payoutModel({
          sellerId: new Types.ObjectId(sellerId),
          totalAmount,
          stripeTransferId: transfer.id,
          status: 'pending',
          periodStart,
          periodEnd,
          earningsIds: earningIds.map((id) => new Types.ObjectId(id)),
        });

        await payout.save();

        await this.sellerEarningsService.markAsPaid(earningIds, transfer.id);

        this.logger.log(
          `Payout created for seller ${sellerId}: ${totalAmount} cents, transfer ${transfer.id}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to process payout for seller ${sellerId}:`,
          error,
        );
        await this.sellerEarningsService.markAsFailed(earningIds);
      }
    }

    this.logger.log('Monthly payout processing completed');
  }

  async markAsCompleted(stripeTransferId: string): Promise<PayoutDocument> {
    const payout = await this.payoutModel
      .findOne({ stripeTransferId })
      .exec();

    if (!payout) {
      throw new NotFoundException(
        `Payout with transfer id ${stripeTransferId} not found`,
      );
    }

    payout.status = 'completed';
    return payout.save();
  }

  async markAsFailed(stripeTransferId: string): Promise<PayoutDocument> {
    const payout = await this.payoutModel
      .findOne({ stripeTransferId })
      .exec();

    if (!payout) {
      throw new NotFoundException(
        `Payout with transfer id ${stripeTransferId} not found`,
      );
    }

    payout.status = 'failed';
    return payout.save();
  }
}
