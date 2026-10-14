import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsNotEmpty,
  IsNotEmptyObject,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class FintavaWebhookDataDto {
  @ApiProperty({ example: '8778.00' })
  @IsString()
  @IsNotEmpty()
  amount: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  charges?: number | null;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  vat?: number;

  @ApiProperty({ example: 'be48d271-b8a5-473f-a358-83d3ab41a775' })
  @IsString()
  @IsNotEmpty()
  reference: string;

  @ApiProperty({ example: 'PENDING' })
  @IsString()
  @IsNotEmpty()
  status: string;

  @ApiPropertyOptional({ example: 'service not available' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ example: '8778.00' })
  @IsOptional()
  @IsString()
  total?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  destination?: string;

  @ApiProperty({ example: 'WDR261012B1A48134E2' })
  @IsString()
  @IsNotEmpty()
  CustomerReference: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  senderName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  senderAccountNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sessionID?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;
}

export class FintavaWebhookDto {
  @ApiProperty({ example: 'customer_bank_transfer' })
  @IsString()
  @IsNotEmpty()
  event: string;

  @ApiProperty({ type: FintavaWebhookDataDto })
  @IsDefined()
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => FintavaWebhookDataDto)
  data: FintavaWebhookDataDto;
}
