import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SellerEarningsService } from './seller-earnings.service';

@Controller('seller-earnings')
@UseGuards(JwtAuthGuard)
export class SellerEarningsController {
  constructor(
    private readonly sellerEarningsService: SellerEarningsService,
  ) {}

  @Get()
  async getMyEarnings(@Request() req: { user: { userId: string } }) {
    return this.sellerEarningsService.findBySeller(req.user.userId);
  }

  @Get('summary')
  async getEarningsSummary(@Request() req: { user: { userId: string } }) {
    return this.sellerEarningsService.getEarningsSummary(req.user.userId);
  }

  @Get('pending')
  async getPendingEarnings(@Request() req: { user: { userId: string } }) {
    return this.sellerEarningsService.findPendingBySeller(req.user.userId);
  }
}
