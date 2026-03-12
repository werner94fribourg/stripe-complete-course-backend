import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { StripeService } from '../stripe/stripe.service';
import { CreateProductDto } from './dtos/create-product.dto';
import { UpdateProductDto } from './dtos/update-product.dto';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly stripeService: StripeService,
  ) {}

  @Post()
  async create(@Body() createProductDto: CreateProductDto) {
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
    );
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
