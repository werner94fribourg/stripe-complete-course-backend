import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StripeService } from '../stripe/stripe.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class ConnectService {
  constructor(
    private readonly stripeService: StripeService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  async createAccount(
    userId: string,
    email: string,
  ): Promise<{ accountId: string; onboardingUrl: string }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }

    if (user.stripeConnectAccountId) {
      throw new BadRequestException('User already has a Connect account');
    }

    // Create Express Connect account
    const account = await this.stripeService.createConnectAccount(email, {
      userId,
    });

    // Update user with Connect account ID
    await this.usersService.setStripeConnectAccountId(userId, account.id);

    // Generate onboarding link
    const refreshUrl = `${this.configService.get<string>('FRONTEND_URL')}/seller/onboarding/refresh`;
    const returnUrl = `${this.configService.get<string>('FRONTEND_URL')}/seller/onboarding/complete`;

    const accountLink = await this.stripeService.createAccountLink(
      account.id,
      refreshUrl,
      returnUrl,
    );

    return {
      accountId: account.id,
      onboardingUrl: accountLink.url,
    };
  }

  async getOnboardingLink(userId: string): Promise<{ url: string }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }

    if (!user.stripeConnectAccountId) {
      throw new BadRequestException(
        'User does not have a Connect account. Create one first.',
      );
    }

    const refreshUrl = `${this.configService.get<string>('FRONTEND_URL')}/seller/onboarding/refresh`;
    const returnUrl = `${this.configService.get<string>('FRONTEND_URL')}/seller/onboarding/complete`;

    const accountLink = await this.stripeService.createAccountLink(
      user.stripeConnectAccountId,
      refreshUrl,
      returnUrl,
    );

    return { url: accountLink.url };
  }

  async getAccountStatus(userId: string): Promise<{
    isReady: boolean;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
  }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }

    if (!user.stripeConnectAccountId) {
      return {
        isReady: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
      };
    }

    const account = await this.stripeService.getConnectAccount(
      user.stripeConnectAccountId,
    );

    const isReady = account.charges_enabled && account.payouts_enabled;

    // Mark user as seller if account is ready and not already marked
    if (isReady && !user.isSeller) {
      await this.usersService.markAsSeller(userId);
    }

    return {
      isReady,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
    };
  }
}
