import { IsOptional, IsString } from 'class-validator';

export class ReportDeviceMetadataDto {
  @IsString()
  deviceId!: string;

  @IsString()
  model!: string;

  @IsString()
  fwVersion!: string;

  @IsOptional()
  @IsString()
  mxeDeviceId?: string;
}
