import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { PlansService } from './plans.service';
import { CreatePlansDto } from './dtos/create-plans.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() createPlansDto: CreatePlansDto) {
    return this.plansService.createPlan(createPlansDto);
  }

  @Get()
  findAll() {
    return this.plansService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.plansService.findOne(id);
  }

  @Get('product/:productId')
  findByProduct(@Param('productId') productId: string) {
    return this.plansService.findByProductId(productId);
  }
}
