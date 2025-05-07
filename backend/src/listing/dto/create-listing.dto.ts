import { IsString, IsNotEmpty, IsNumber, Min } from 'class-validator';

export class CreateListingDto {
  @IsString() @IsNotEmpty()
  deviceId: string;

  @IsNumber() @Min(1)
  pricePerUnit: number;

  @IsNumber() @Min(1)
  totalDataUnits: number;
}