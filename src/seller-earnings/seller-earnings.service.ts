import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  SellerEarnings,
  SellerEarningsDocument,
} from './schemas/seller-earnings.schema';

export interface CreateEarningDto {
  sellerId: string;
  orderId: string;
  productId: string;
  grossAmount: number;
  platformFee: number;
  netAmount: number;
  paymentIntentId: string;
}

export interface EarningsSummary {
  totalEarnings: number;
  pendingEarnings: number;
  paidEarnings: number;
  earningsCount: number;
}

@Injectable()
export class SellerEarningsService {
  constructor(
    @InjectModel(SellerEarnings.name)
    private sellerEarningsModel: Model<SellerEarnings>,
  ) {}

  async createEarning(data: CreateEarningDto): Promise<SellerEarningsDocument> {
    const earning = new this.sellerEarningsModel({
      sellerId: new Types.ObjectId(data.sellerId),
      orderId: new Types.ObjectId(data.orderId),
      productId: new Types.ObjectId(data.productId),
      grossAmount: data.grossAmount,
      platformFee: data.platformFee,
      netAmount: data.netAmount,
      paymentIntentId: data.paymentIntentId,
      status: 'pending',
    });

    return earning.save();
  }

  async findOne(id: string): Promise<SellerEarningsDocument> {
    const earning = await this.sellerEarningsModel.findById(id).exec();
    if (!earning) {
      throw new NotFoundException(`Earning with id ${id} not found`);
    }
    return earning;
  }

  async findBySeller(sellerId: string): Promise<SellerEarningsDocument[]> {
    return this.sellerEarningsModel
      .find({ sellerId: new Types.ObjectId(sellerId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findPendingBySeller(
    sellerId: string,
  ): Promise<SellerEarningsDocument[]> {
    return this.sellerEarningsModel
      .find({
        sellerId: new Types.ObjectId(sellerId),
        status: 'pending',
      })
      .exec();
  }

  async findAllPendingGroupedBySeller(): Promise<
    { sellerId: string; totalAmount: number; earningIds: string[] }[]
  > {
    const result = await this.sellerEarningsModel.aggregate([
      { $match: { status: 'pending' } },
      {
        $group: {
          _id: '$sellerId',
          totalAmount: { $sum: '$netAmount' },
          earningIds: { $push: '$_id' },
        },
      },
    ]);

    return result.map((r) => ({
      sellerId: r._id.toString(),
      totalAmount: r.totalAmount,
      earningIds: r.earningIds.map((id: Types.ObjectId) => id.toString()),
    }));
  }

  async markAsPaid(
    earningIds: string[],
    transferId: string,
  ): Promise<void> {
    await this.sellerEarningsModel.updateMany(
      { _id: { $in: earningIds.map((id) => new Types.ObjectId(id)) } },
      {
        $set: {
          status: 'paid',
          stripeTransferId: transferId,
          paidAt: new Date(),
        },
      },
    );
  }

  async markAsFailed(earningIds: string[]): Promise<void> {
    await this.sellerEarningsModel.updateMany(
      { _id: { $in: earningIds.map((id) => new Types.ObjectId(id)) } },
      { $set: { status: 'failed' } },
    );
  }

  async getEarningsSummary(sellerId: string): Promise<EarningsSummary> {
    const earnings = await this.findBySeller(sellerId);

    const summary: EarningsSummary = {
      totalEarnings: 0,
      pendingEarnings: 0,
      paidEarnings: 0,
      earningsCount: earnings.length,
    };

    for (const earning of earnings) {
      summary.totalEarnings += earning.netAmount;
      if (earning.status === 'pending') {
        summary.pendingEarnings += earning.netAmount;
      } else if (earning.status === 'paid') {
        summary.paidEarnings += earning.netAmount;
      }
    }

    return summary;
  }

  async getSellerTotalPending(sellerId: string): Promise<number> {
    const pendingEarnings = await this.findPendingBySeller(sellerId);
    return pendingEarnings.reduce((sum, e) => sum + e.netAmount, 0);
  }
}
