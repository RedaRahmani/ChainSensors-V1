import { IsString, IsNotEmpty } from 'class-validator';

export class CancelListingDto {
  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @IsString()
  @IsNotEmpty()
  listingId: string;
}
