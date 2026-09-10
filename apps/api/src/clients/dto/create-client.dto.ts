import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsTimeZone,
  IsUrl,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';

export class CreateClientDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 200)
  name!: string;

  @IsString()
  @Length(1, 100)
  // Require the absolute end, including rejection of a final newline.
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*(?![\s\S])/)
  slug!: string;

  @IsOptional()
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    require_valid_protocol: true,
    require_tld: false,
  })
  website?: string | null;

  @ValidateIf((_: unknown, value: unknown) => value !== undefined)
  @IsString()
  @IsTimeZone()
  @Matches(/^[A-Za-z]/, { message: 'timezone must be a named IANA time zone' })
  timezone?: string;
}
