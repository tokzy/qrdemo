import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class SubmitBeneficiaryDto {
  @ApiProperty({ example: 'Ada Lovelace' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  @IsString()
  @IsNotEmpty()
  @Length(2, 150)
  @Matches(/^[A-Za-z][A-Za-z\s.'-]*$/, {
    message: 'accountName must contain only letters, spaces, hyphens, or apostrophes',
  })
  accountName: string;

  @ApiProperty({ example: '0123456789' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.replace(/\s+/g, '') : value,
  )
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{10}$/, {
    message: 'accountNumber must be exactly 10 digits',
  })
  accountNumber: string;

  @ApiProperty({ example: 'Access Bank' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  @IsString()
  @IsNotEmpty()
  @Length(2, 150)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9\s.&'-]*$/, {
    message: 'bankName contains invalid characters',
  })
  bankName: string;
}
