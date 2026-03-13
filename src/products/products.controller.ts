import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { StripeService } from '../stripe/stripe.service';
import { UsersService } from '../users/users.service';
import { CreateProductDto } from './dtos/create-product.dto';
import { UpdateProductDto } from './dtos/update-product.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly stripeService: StripeService,
    private readonly usersService: UsersService,
  ) {}

  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  async create(
    @Body() createProductDto: CreateProductDto,
    @Request() req: { user?: { userId: string } },
  ) {
    let ownerId: string | undefined;

    if (createProductDto.isOwner) {
      if (!req.user) {
        throw new BadRequestException(
          'You must be logged in to create a product as owner',
        );
      }

      const user = await this.usersService.findById(req.user.userId);
      if (!user) {
        throw new BadRequestException('User not found');
      }

      if (!user.stripeConnectAccountId) {
        throw new BadRequestException(
          'You must complete seller onboarding before creating a product as owner. Please visit /seller/onboarding to set up your seller account.',
        );
      }

      const isReady = await this.stripeService.isConnectAccountReady(
        user.stripeConnectAccountId,
      );

      if (!isReady) {
        throw new BadRequestException(
          'Your seller account is not fully set up. Please complete onboarding at /seller/onboarding.',
        );
      }

      ownerId = req.user.userId;
    }

    const stripeProduct = await this.stripeService.createProduct(
      createProductDto.name,
      createProductDto.description,
    );

    const stripePrice = await this.stripeService.createOneTimePrice(
      stripeProduct.id,
      Math.round(createProductDto.price),
    );

    const stripeRecurringPrice = await this.stripeService.createRecurringPrice(
      stripeProduct.id,
      Math.round(createProductDto.price),
      'month',
    );

    return this.productsService.create(
      createProductDto,
      stripeProduct.id,
      stripePrice.id,
      stripeRecurringPrice.id,
      ownerId,
    );
  }

  @Get('my-products')
  @UseGuards(JwtAuthGuard)
  async getMyProducts(@Request() req: { user: { userId: string } }) {
    return this.productsService.findByOwnerId(req.user.userId);
  }

  @Get()
  findAll() {
    return this.productsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    const product = await this.productsService.findOne(id);

    if (updateProductDto.name || updateProductDto.description) {
      await this.stripeService.updateProduct(product.stripeProductId, {
        name: updateProductDto.name,
        description: updateProductDto.description,
      });
    }

    if (updateProductDto.price !== undefined) {
      await this.stripeService.deactivatePrice(product.stripePriceId);

      const newPrice = await this.stripeService.createOneTimePrice(
        product.stripeProductId,
        Math.round(updateProductDto.price),
      );

      await this.productsService.updateStripePriceId(id, newPrice.id);

      if (product.stripeRecurringPriceId) {
        await this.stripeService.deactivatePrice(
          product.stripeRecurringPriceId,
        );

        const newRecurringPrice = await this.stripeService.createRecurringPrice(
          product.stripeProductId,
          Math.round(updateProductDto.price),
          'month',
        );

        await this.productsService.updateStripeRecurringPriceId(
          id,
          newRecurringPrice.id,
        );
      }
    }

    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    const product = await this.productsService.findOne(id);

    await this.stripeService.archiveProduct(product.stripeProductId);

    await this.productsService.delete(id);
  }
}
