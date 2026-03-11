import { IsNumber, IsOptional, IsPositive } from 'class-validator';

export class RefundDto {
  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number;
}
