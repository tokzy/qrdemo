import { getQueueToken } from '@nestjs/bull';
import { INestApplication } from '@nestjs/common';
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bull';
import {
  FINTAVA_TRANSFER_QUEUE,
  FINTAVA_WEBHOOK_QUEUE,
} from 'src/common/services/fintava/fintava.types';

export function setupBullBoard(app: INestApplication): void {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  const transferQueue = app.get<Queue>(getQueueToken(FINTAVA_TRANSFER_QUEUE));
  const webhookQueue = app.get<Queue>(getQueueToken(FINTAVA_WEBHOOK_QUEUE));
  createBullBoard({
    queues: [
      new BullAdapter(transferQueue),
      new BullAdapter(webhookQueue),
    ],
    serverAdapter,
  });

  app.use('/admin/queues', serverAdapter.getRouter());
}
