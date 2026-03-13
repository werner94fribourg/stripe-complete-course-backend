import { Controller, Get, Param, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PayoutsService } from './payouts.service';

@Controller('payouts')
@UseGuards(JwtAuthGuard)
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Get()
  async getMyPayouts(@Request() req: { user: { userId: string } }) {
    return this.payoutsService.findBySeller(req.user.userId);
  }

  @Get(':id')
  async getPayoutById(@Param('id') id: string) {
    return this.payoutsService.findOne(id);
  }
}
