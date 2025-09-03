import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateDeviceMetadataDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  deviceName?: string;
}
