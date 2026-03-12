import { IsString, IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { RangeDto } from './range.dto';

export class CreatePlansDto {
  @IsString()
  productId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RangeDto)
  ranges: RangeDto[];
}
