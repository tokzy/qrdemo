import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bull';
import {
  FINTAVA_TRANSFER_QUEUE,
  FINTAVA_WEBHOOK_QUEUE,
} from 'src/common/services/fintava/fintava.types';

@Injectable()
export class QueueConnectionLogger implements OnModuleInit {
  private readonly logger = new Logger(QueueConnectionLogger.name);

  constructor(
    @InjectQueue(FINTAVA_TRANSFER_QUEUE)
    private readonly transferQueue: Queue,
    @InjectQueue(FINTAVA_WEBHOOK_QUEUE)
    private readonly webhookQueue: Queue,
  ) {}

  onModuleInit(): void {
    for (const queue of [this.transferQueue, this.webhookQueue]) {
      queue.on('error', (error: Error) => {
        this.logger.error(`${queue.name} redis error: ${error.message}`);
      });
      void this.ping(queue);
    }
  }

  private async ping(queue: Queue): Promise<void> {
    try {
      await queue.client.ping();
      this.logger.log(`${queue.name} redis connected`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Redis ping failed';
      this.logger.error(`${queue.name} redis ping failed: ${message}`);
    }
  }
}
