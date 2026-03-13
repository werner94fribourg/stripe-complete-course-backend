import { Controller, Get, Post, Body, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConnectService } from './connect.service';

@Controller('connect')
@UseGuards(JwtAuthGuard)
export class ConnectController {
  constructor(private readonly connectService: ConnectService) {}

  @Post('create-account')
  async createAccount(
    @Request() req: { user: { userId: string; email: string } },
    @Body() body: { email?: string },
  ) {
    const email = body.email || req.user.email;
    return this.connectService.createAccount(req.user.userId, email);
  }

  @Get('onboarding-link')
  async getOnboardingLink(@Request() req: { user: { userId: string } }) {
    return this.connectService.getOnboardingLink(req.user.userId);
  }

  @Get('status')
  async getStatus(@Request() req: { user: { userId: string } }) {
    return this.connectService.getAccountStatus(req.user.userId);
  }
}
