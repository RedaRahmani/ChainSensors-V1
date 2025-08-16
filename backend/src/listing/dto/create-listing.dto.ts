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

  // Relaxed from 64 → 128 to stop the previous error
  @IsString() @IsNotEmpty() @MaxLength(128)
  dekCapsuleForMxeCid!: string;
}
