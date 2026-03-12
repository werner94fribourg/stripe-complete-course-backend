import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionService } from './subscription.service';
import { CreateSubscriptionDto } from './dtos/create-subscription.dto';

@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createSubscription(
    @Request() req: { user: { userId: string; username: string } },
    @Body() dto: CreateSubscriptionDto,
  ) {
    const { userId } = req.user;
    return this.subscriptionService.createSubscription(userId, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getMySubscriptions(@Request() req: { user: { userId: string } }) {
    const { userId } = req.user;
    return this.subscriptionService.findByUserId(userId);
  }

  @Get('active')
  @UseGuards(JwtAuthGuard)
  async getMyActiveSubscriptions(@Request() req: { user: { userId: string } }) {
    const { userId } = req.user;
    return this.subscriptionService.findActiveByUserId(userId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getSubscription(@Param('id') id: string) {
    return this.subscriptionService.findOne(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async cancelSubscription(
    @Param('id') id: string,
    @Query('immediately') immediately?: string,
  ) {
    const cancelImmediately = immediately === 'true';
    return this.subscriptionService.cancelSubscription(id, cancelImmediately);
  }
}
