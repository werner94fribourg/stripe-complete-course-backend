import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateProductDto } from './dtos/create-product.dto';
import { UpdateProductDto } from './dtos/update-product.dto';
import { Product, ProductDocument } from './schemas/product.schema';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<Product>,
  ) {}

  async create(
    createProductDto: CreateProductDto,
    stripeProductId: string,
    stripePriceId: string,
    stripeRecurringPriceId?: string,
    ownerId?: string,
  ): Promise<ProductDocument> {
    const product = new this.productModel({
      name: createProductDto.name,
      description: createProductDto.description,
      price: createProductDto.price,
      stripeProductId,
      stripePriceId,
      stripeRecurringPriceId: stripeRecurringPriceId || null,
      ownerId: ownerId ? new Types.ObjectId(ownerId) : null,
    });
    return product.save();
  }

  async findAll(): Promise<ProductDocument[]> {
    return this.productModel.find().exec();
  }

  async findOne(id: string): Promise<ProductDocument> {
    const product = await this.productModel.findById(id).exec();
    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }
    return product;
  }

  async findByStripeProductId(
    stripeProductId: string,
  ): Promise<ProductDocument | null> {
    return this.productModel.findOne({ stripeProductId }).exec();
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<ProductDocument> {
    const product = await this.productModel.findById(id);
    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }
    Object.assign(product, updateProductDto);
    return product.save();
  }

  async updateStripePriceId(
    id: string,
    stripePriceId: string,
  ): Promise<ProductDocument> {
    const product = await this.productModel.findById(id);
    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }
    product.stripePriceId = stripePriceId;
    return product.save();
  }

  async updateStripeRecurringPriceId(
    id: string,
    stripeRecurringPriceId: string,
  ): Promise<ProductDocument> {
    const product = await this.productModel.findById(id);
    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }
    product.stripeRecurringPriceId = stripeRecurringPriceId;
    return product.save();
  }

  async delete(id: string): Promise<void> {
    const result = await this.productModel.findByIdAndDelete(id);
    if (!result) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }
  }

  async findByOwnerId(ownerId: string): Promise<ProductDocument[]> {
    return this.productModel
      .find({ ownerId: new Types.ObjectId(ownerId) })
      .exec();
  }

  async setOwner(id: string, ownerId: string): Promise<ProductDocument> {
    const product = await this.productModel.findById(id);
    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }
    product.ownerId = new Types.ObjectId(ownerId);
    return product.save();
  }
}
