import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdatePaymentStatusDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  isPaid: boolean;
}
