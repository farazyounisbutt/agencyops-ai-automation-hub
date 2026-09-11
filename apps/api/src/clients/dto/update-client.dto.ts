import { Transform } from 'class-transformer';
import {
  CLIENT_SLUG_PATTERN,
  CLIENT_WEBSITE_OPTIONS,
  trimClientName,
} from './client-validation.js';
import {
  IsOptional,
  IsString,
  IsTimeZone,
  IsUrl,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';

export class UpdateClientDto {
  @ValidateIf((_: unknown, value: unknown) => value !== undefined)
  @Transform(trimClientName)
  @IsString()
  @Length(1, 200)
  name?: string;

  @ValidateIf((_: unknown, value: unknown) => value !== undefined)
  @IsString()
  @Length(1, 100)
  // Require the absolute end, including rejection of a final newline.
  @Matches(CLIENT_SLUG_PATTERN)
  slug?: string;

  @IsOptional()
  @IsUrl(CLIENT_WEBSITE_OPTIONS)
  website?: string | null;

  @ValidateIf((_: unknown, value: unknown) => value !== undefined)
  @IsString()
  @IsTimeZone()
  @Matches(/^[A-Za-z]/, { message: 'timezone must be a named IANA time zone' })
  timezone?: string;
}
