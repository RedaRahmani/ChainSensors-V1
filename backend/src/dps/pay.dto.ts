import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class PayIntentDto {
  @IsString() @IsNotEmpty()
  sellerPubkey!: string;

  @IsString() @IsNotEmpty()
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsOptional() @IsString()
  phone?: string;

  @IsString() @IsNotEmpty()
  address!: string;
}

export class PayFinalizeDto {
  @IsString() @IsNotEmpty()
  orderId!: string;

  @IsString() @IsNotEmpty()
  signedTxB64!: string;
}
