import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bull';
import { FintavaService } from 'src/common/services/fintava/fintava.service';
import { FINTAVA_TRANSFER_QUEUE } from 'src/common/services/fintava/fintava.types';
import { Repository } from 'typeorm';
import { Beneficiary } from './entities/beneficiary.entity';
import {
  Transaction,
  TransactionStatus,
} from './entities/transaction.entity';

@Processor(FINTAVA_TRANSFER_QUEUE)
export class FintavaTransferProcessor {
  private readonly logger = new Logger(FintavaTransferProcessor.name);

  constructor(
    @InjectRepository(Beneficiary)
    private readonly beneficiaryRepository: Repository<Beneficiary>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly fintavaService: FintavaService,
  ) {}

  @Process('payout')
  async payout(job: Job<{ beneficiaryId: string }>): Promise<void> {
    const { beneficiaryId } = job.data;
    const beneficiary = await this.beneficiaryRepository.findOne({
      where: { id: beneficiaryId },
    });

    if (!beneficiary) {
      throw new Error(`Beneficiary ${beneficiaryId} was not found`);
    }

    if (beneficiary.isPaid) {
      return;
    }

    const customerReference = beneficiary.id;
    const existing = await this.transactionRepository.findOne({
      where: { customerReference },
    });

    if (
      existing?.status === TransactionStatus.SUCCESSFUL ||
      existing?.status === TransactionStatus.SUBMITTED ||
      existing?.providerReference
    ) {
      return;
    }

    if (!beneficiary.amount || beneficiary.amount <= 0) {
      await this.saveFailure(
        beneficiary,
        existing,
        'Beneficiary amount is not set',
      );
      throw new Error('Beneficiary amount is not set');
    }

    if (
      !beneficiary.accountNumber ||
      !beneficiary.accountName ||
      !beneficiary.bankName
    ) {
      await this.saveFailure(
        beneficiary,
        existing,
        'Beneficiary account details are incomplete',
      );
      throw new Error('Beneficiary account details are incomplete');
    }

    let sortCode: string;
    try {
      sortCode = await this.fintavaService.resolveSortCode(
        beneficiary.bankName,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to resolve bank';
      await this.saveFailure(beneficiary, existing, message);
      throw error;
    }

    const transaction = await this.transactionRepository.save(
      this.transactionRepository.create({
        ...(existing?.id ? { id: existing.id } : {}),
        beneficiaryId: beneficiary.id,
        accountName: beneficiary.accountName,
        accountNumber: beneficiary.accountNumber,
        bankName: beneficiary.bankName,
        sortCode,
        amount: beneficiary.amount,
        narration: 'QR payout',
        customerReference,
        status: TransactionStatus.SUBMITTED,
      }),
    );

    try {
      const request = await this.fintavaService.transfer({
        narration: transaction.narration,
        accountNumber: transaction.accountNumber,
        accountName: transaction.accountName,
        sortCode,
        amount: Number(beneficiary.amount),
        CustomerReference: customerReference,
      });

      transaction.providerMessage =
        request.message || 'Waiting for the Fintava webhook';
      transaction.providerResponse = request.body;
      transaction.providerReference = request.reference;
      transaction.status = TransactionStatus.SUBMITTED;
      await this.transactionRepository.save(transaction);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Fintava transfer request failed';
      transaction.providerMessage = message;
      transaction.status = TransactionStatus.SUBMITTED;
      await this.transactionRepository.save(transaction);
      this.logger.warn(
        `Transfer request for ${beneficiary.id} did not return. Waiting for the Fintava webhook.`,
      );
    }
  }

  private async saveFailure(
    beneficiary: Beneficiary,
    existing: Transaction | null,
    message: string,
  ): Promise<void> {
    await this.transactionRepository.save(
      this.transactionRepository.create({
        ...(existing?.id ? { id: existing.id } : {}),
        beneficiaryId: beneficiary.id,
        accountName: beneficiary.accountName || 'Unknown',
        accountNumber: beneficiary.accountNumber || '0000000000',
        bankName: beneficiary.bankName || 'Unknown',
        amount: beneficiary.amount || 0,
        narration: 'QR payout',
        customerReference: beneficiary.id,
        status: TransactionStatus.FAILED,
        providerMessage: message,
      }),
    );
  }
}
