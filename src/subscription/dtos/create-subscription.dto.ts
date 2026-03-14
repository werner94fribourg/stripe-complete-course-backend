import {
  IsString,
  IsOptional,
  IsDateString,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export class CreateSubscriptionDto {
  @IsString()
  productId: string;

  @IsString()
  planId: string;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(730)
  trialPeriodDays?: number;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
