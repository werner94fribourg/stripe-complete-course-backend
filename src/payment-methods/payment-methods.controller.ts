import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaymentMethodsService } from './payment-methods.service';

@Controller('payment-methods')
@UseGuards(JwtAuthGuard)
export class PaymentMethodsController {
  constructor(private readonly paymentMethodsService: PaymentMethodsService) {}

  @Post('setup-intent')
  async createSetupIntent(@Request() req: { user: { userId: string } }) {
    return this.paymentMethodsService.createSetupIntent(req.user.userId);
  }

  @Get()
  async listPaymentMethods(@Request() req: { user: { userId: string } }) {
    return this.paymentMethodsService.listPaymentMethods(req.user.userId);
  }

  @Delete(':id')
  async deletePaymentMethod(
    @Request() req: { user: { userId: string } },
    @Param('id') paymentMethodId: string,
  ) {
    await this.paymentMethodsService.deletePaymentMethod(
      req.user.userId,
      paymentMethodId,
    );
    return { success: true };
  }

  @Post(':id/default')
  async setDefaultPaymentMethod(
    @Request() req: { user: { userId: string } },
    @Param('id') paymentMethodId: string,
  ) {
    await this.paymentMethodsService.setDefaultPaymentMethod(
      req.user.userId,
      paymentMethodId,
    );
    return { success: true };
  }
}
