import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bull';
import { FintavaService } from 'src/common/services/fintava/fintava.service';
import { FINTAVA_WEBHOOK_QUEUE } from 'src/common/services/fintava/fintava.types';
import { Repository } from 'typeorm';
import { FintavaWebhookDto } from './dto/fintava-webhook.dto';
import { Beneficiary } from './entities/beneficiary.entity';
import {
  Transaction,
  TransactionStatus,
} from './entities/transaction.entity';

@Processor(FINTAVA_WEBHOOK_QUEUE)
export class FintavaWebhookProcessor {
  private readonly logger = new Logger(FintavaWebhookProcessor.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly fintavaService: FintavaService,
  ) {}

  @Process({ name: 'apply', concurrency: 10 })
  async apply(job: Job<FintavaWebhookDto>): Promise<void> {
    const { event, data } = job.data;
    const state = this.fintavaService.classifyTransferStatus(data.status);

    await this.transactionRepository.manager.transaction(async (manager) => {
      const transaction = await this.lockTransaction(
        manager,
        data.CustomerReference,
        data.reference,
      );

      if (!transaction) {
        throw new Error(
          `No payout matches Fintava reference ${data.CustomerReference}`,
        );
      }

      if (
        state === 'pending' &&
        (transaction.status === TransactionStatus.SUCCESSFUL ||
          transaction.status === TransactionStatus.FAILED)
      ) {
        return;
      }

      const webhookAmount = Number(data.amount);
      const amountsMatch =
        Number.isFinite(webhookAmount) &&
        Math.abs(webhookAmount - Number(transaction.amount)) < 0.01;

      transaction.providerReference =
        data.reference || transaction.providerReference;
      transaction.providerResponse = { event, data: { ...data } };

      if (!amountsMatch) {
        transaction.providerMessage = `Webhook amount ${data.amount} does not match payout ${transaction.amount}`;
        await manager.save(transaction);
        this.logger.warn(transaction.providerMessage);
        return;
      }

      transaction.providerMessage =
        data.reason || data.description || `Fintava status is ${data.status}`;
      transaction.status =
        state === 'successful'
          ? TransactionStatus.SUCCESSFUL
          : state === 'failed'
            ? TransactionStatus.FAILED
            : TransactionStatus.SUBMITTED;

      await manager.save(transaction);
      await manager.update(
        Beneficiary,
        { id: transaction.beneficiaryId },
        { isPaid: state === 'successful' },
      );
      this.logger.log(
        `Webhook ${data.status} applied for ${transaction.customerReference}`,
      );
    });
  }

  private async lockTransaction(
    manager: Repository<Transaction>['manager'],
    customerReference: string,
    reference: string,
  ): Promise<Transaction | null> {
    const byCustomerReference = await manager
      .getRepository(Transaction)
      .createQueryBuilder('transaction')
      .setLock('pessimistic_write')
      .where('transaction.customerReference = :customerReference', {
        customerReference,
      })
      .getOne();

    if (byCustomerReference) {
      return byCustomerReference;
    }

    return manager
      .getRepository(Transaction)
      .createQueryBuilder('transaction')
      .setLock('pessimistic_write')
      .where('transaction.providerReference = :reference', { reference })
      .getOne();
  }
}
