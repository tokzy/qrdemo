import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FintavaModule } from 'src/common/services/fintava/fintava.module';
import {
  FINTAVA_TRANSFER_QUEUE,
  FINTAVA_WEBHOOK_QUEUE,
} from 'src/common/services/fintava/fintava.types';
import { Beneficiary } from './entities/beneficiary.entity';
import { Transaction } from './entities/transaction.entity';
import { FintavaTransferProcessor } from './fintava-transfer.processor';
import { FintavaWebhookController } from './fintava-webhook.controller';
import { FintavaWebhookProcessor } from './fintava-webhook.processor';
import { QueueConnectionLogger } from 'src/config/queue/queue-connection.logger';
import { QrcodeController } from './qrcode.controller';
import { QrcodeService } from './qrcode.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Beneficiary, Transaction]),
    BullModule.registerQueue(
      { name: FINTAVA_TRANSFER_QUEUE },
      { name: FINTAVA_WEBHOOK_QUEUE },
    ),
    FintavaModule,
  ],
  controllers: [QrcodeController, FintavaWebhookController],
  providers: [
    QrcodeService,
    FintavaTransferProcessor,
    FintavaWebhookProcessor,
    QueueConnectionLogger,
  ],
})
export class QrcodeModule {}
