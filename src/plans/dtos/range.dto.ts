import { IsString, IsNumber, IsPositive, IsIn } from 'class-validator';

const VALID_INTERVALS = ['day', 'week', 'month', 'year'] as const;

export class RangeDto {
  @IsString()
  @IsIn(VALID_INTERVALS, {
    message: 'recurring_interval must be one of: day, week, month, year',
  })
  recurring_interval: 'day' | 'week' | 'month' | 'year';

  @IsNumber()
  @IsPositive()
  unit_amount: number;

  @IsString()
  lookup_key: string;
}
