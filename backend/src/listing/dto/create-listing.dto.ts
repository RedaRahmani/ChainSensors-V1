import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsOptional,
} from 'class-validator';

export class CreateListingDto {
  @IsString()
  readonly deviceId: string;

  @IsString()
  @IsNotEmpty()
  dataCid: string;

  @IsNumber()
  @Min(1)
  pricePerUnit: number;

  @IsNumber()
  @Min(1)
  totalDataUnits: number;

  @IsString()
  sellerPubkey: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  expiresAt?: number;
}
