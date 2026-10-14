import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FintavaWebhookDto } from './dto/fintava-webhook.dto';
import { QrcodeService } from './qrcode.service';

@ApiTags('webhooks')
@Controller('webhooks')
export class FintavaWebhookController {
  constructor(private readonly qrcodeService: QrcodeService) {}

  @Post('fintava')
  @HttpCode(HttpStatus.OK)
  receive(@Body() payload: FintavaWebhookDto) {
    return this.qrcodeService.enqueueFintavaWebhook(payload);
  }
}
