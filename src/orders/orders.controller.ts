import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreateOrderDto } from './dtos/create-order.dto';
import { RefundDto } from './dtos/refund.dto';
import { OrdersService } from './orders.service';
import { StripeService } from '../stripe/stripe.service';
import { UsersService } from '../users/users.service';
import { ProductsService } from '../products/products.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('orders')
export class OrdersController {
  private readonly platformFeePercent: number;

  constructor(
    private readonly stripeService: StripeService,
    private readonly ordersService: OrdersService,
    private readonly usersService: UsersService,
    private readonly productsService: ProductsService,
    private readonly configService: ConfigService,
  ) {
    this.platformFeePercent =
      this.configService.get<number>('PLATFORM_FEE_PERCENTAGE') || 10;
  }

  private async ensureStripeCustomer(userId: string): Promise<string> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new BadRequestException(`User with id ${userId} not found`);
    }

    const { email, username, stripeCustomerId } = user;

    if (stripeCustomerId) {
      return stripeCustomerId;
    }

    const customer = await this.stripeService.createCustomer(email, username, {
      userId,
    });

    await this.usersService.setStripeCustomerId(userId, customer.id);

    return customer.id;
  }

  @Post('payment-intent')
  async createPaymentIntent(@Body() dto: CreateOrderDto) {
    const { userId, items } = dto;

    const stripeCustomerId = await this.ensureStripeCustomer(userId);

    const order = await this.ordersService.create(
      userId,
      items,
      stripeCustomerId,
    );

    const sellerProducts: Array<{
      productId: string;
      sellerId: string;
      connectedAccountId: string;
      amount: number;
    }> = [];

    for (const item of items) {
      const product = await this.productsService.findOne(item.productId);
      if (product.ownerId) {
        const seller = await this.usersService.findById(
          product.ownerId.toString(),
        );
        if (seller?.stripeConnectAccountId) {
          const isReady = await this.stripeService.isConnectAccountReady(
            seller.stripeConnectAccountId,
          );
          if (isReady) {
            sellerProducts.push({
              productId: item.productId,
              sellerId: product.ownerId.toString(),
              connectedAccountId: seller.stripeConnectAccountId,
              amount: product.price * item.quantity,
            });
          }
        }
      }
    }

    if (sellerProducts.length === 1) {
      const sellerProduct = sellerProducts[0];
      const platformFee = Math.round(
        (order.total * this.platformFeePercent) / 100,
      );

      const paymentIntent =
        await this.stripeService.getPaymentIntentWithConnect(
          order.total,
          order._id.toString(),
          userId,
          sellerProduct.connectedAccountId,
          platformFee,
          stripeCustomerId,
          {
            sellerId: sellerProduct.sellerId,
            productId: sellerProduct.productId,
          },
        );

      return { clientSecret: paymentIntent.client_secret, order };
    }

    if (sellerProducts.length > 1) {
      throw new BadRequestException(
        'Orders with products from multiple sellers are not supported yet. Please create separate orders for each seller.',
      );
    }

    const paymentIntent = await this.stripeService.getPaymentIntent(
      order.total,
      order._id.toString(),
      userId,
      stripeCustomerId,
    );

    return { clientSecret: paymentIntent.client_secret, order };
  }

  @Get()
  findAll() {
    return this.ordersService.findAll();
  }

  @Get('user')
  @UseGuards(JwtAuthGuard)
  async findByUser(@Request() req: { user: { userId: string } }) {
    return this.ordersService.findByUserId(req.user.userId);
  }

  @Post('checkout-session')
  async createCheckoutSession(@Body() dto: CreateOrderDto) {
    const { userId, items } = dto;

    const stripeCustomerId = await this.ensureStripeCustomer(userId);

    const order = await this.ordersService.create(
      userId,
      items,
      stripeCustomerId,
    );

    const lineItems = await Promise.all(
      items.map(async (item) => {
        const product = await this.productsService.findOne(item.productId);
        return {
          priceId: product.stripePriceId,
          quantity: item.quantity,
        };
      }),
    );

    const session = await this.stripeService.getCheckoutSession(
      order._id.toString(),
      userId,
      lineItems,
      stripeCustomerId,
    );

    await this.ordersService.setCheckoutSessionId(
      order._id.toString(),
      session.id,
    );

    return { url: session.url, sessionId: session.id, order };
  }

  @Post(':id/refund')
  async refundOrder(@Param('id') id: string, @Body() dto: RefundDto) {
    const order = await this.ordersService.findOne(id);

    if (!order.paymentIntentId) {
      throw new BadRequestException('Cannot refund: no payment associated');
    }

    if (order.pending) {
      throw new BadRequestException('Cannot refund: payment still pending');
    }

    if (order.isFailed) {
      throw new BadRequestException('Cannot refund: payment failed');
    }

    const refund = await this.stripeService.createRefund(
      order.paymentIntentId,
      dto.amount,
    );

    return {
      refundId: refund.id,
      amount: refund.amount / 100,
      status: refund.status,
      orderId: order._id.toString(),
    };
  }
}
