import { IsString, IsNotEmpty, IsNumber, IsOptional, MaxLength } from 'class-validator';

export class CreateListingDto {
  @IsString() @IsNotEmpty()
  sellerPubkey!: string;

  @IsString() @IsNotEmpty()
  deviceId!: string;

  @IsString() @IsNotEmpty()
  dataCid!: string;

  @IsNumber()
  pricePerUnit!: number;

  @IsNumber()
  totalDataUnits!: number;

  @IsOptional()
  @IsNumber()
  expiresAt?: number | null;

  // Now OPTIONAL: service will verify/repair from device metadata if missing or invalid
  @IsOptional()
  @IsString()
  @MaxLength(128)
  dekCapsuleForMxeCid?: string;
}
