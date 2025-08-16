import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsOptional,
  MaxLength,
} from 'class-validator';

export class CreateListingDto {
  @IsString()
  readonly deviceId: string;

  @IsString()
  @IsNotEmpty()
  dataCid: string;

  @IsString() @MaxLength(64)
  dekCapsuleForMxeCid!: string;

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
