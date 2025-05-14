import { IsString, IsNotEmpty, IsNumber, Min, Max, IsOptional, MaxLength } from 'class-validator';

export class CreateRatingDto {
  @IsString()   @IsNotEmpty()   userPubkey: string;
  @IsString()   @IsNotEmpty()   listingId:  string;
  @IsNumber()   @Min(1) @Max(5) rating:     number;
  @IsString()   @IsOptional() @MaxLength(128) comment?:    string;
}
