import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bull';
import * as QRCode from 'qrcode';
import { FintavaService } from 'src/common/services/fintava/fintava.service';
import {
  FINTAVA_TRANSFER_QUEUE,
  FINTAVA_WEBHOOK_QUEUE,
} from 'src/common/services/fintava/fintava.types';
import { Repository } from 'typeorm';
import { FintavaWebhookDto } from './dto/fintava-webhook.dto';
import { GenerateQrCodeDto } from './dto/generate-qrcode.dto';
import { SubmitBeneficiaryDto } from './dto/submit-beneficiary.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { Beneficiary } from './entities/beneficiary.entity';
import { Transaction } from './entities/transaction.entity';

@Injectable()
export class QrcodeService {
  constructor(
    @InjectRepository(Beneficiary)
    private readonly beneficiaryRepository: Repository<Beneficiary>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly configService: ConfigService,
    private readonly fintavaService: FintavaService,
    @InjectQueue(FINTAVA_TRANSFER_QUEUE)
    private readonly payoutQueue: Queue,
    @InjectQueue(FINTAVA_WEBHOOK_QUEUE)
    private readonly webhookQueue: Queue,
  ) {}

  async generate(generateQrCodeDto: GenerateQrCodeDto, apiOrigin: string) {
    const frontendBaseUrl = this.getFrontendBaseUrl();
    const beneficiary = await this.beneficiaryRepository.save(
      this.beneficiaryRepository.create({
        amount: generateQrCodeDto?.amount ?? null,
        isPaid: false,
      }),
    );

    const url = `${frontendBaseUrl}/beneficiary/${beneficiary.id}`;
    const qrImageUrl = `${apiOrigin}/api/qrcode/${beneficiary.id}/image`;
    const qrCode = await this.createQrCode(url);

    return {
      statusCode: 201,
      message: 'QR code generated',
      data: {
        id: beneficiary.id,
        amount: beneficiary.amount,
        isPaid: beneficiary.isPaid,
        url,
        qrImageUrl,
        qrCode,
        dateCreated: beneficiary.dateCreated,
      },
    };
  }

  async findAll() {
    const beneficiaries = await this.beneficiaryRepository.find({
      order: { dateCreated: 'DESC' },
    });

    return {
      statusCode: 200,
      message: 'success',
      data: beneficiaries,
    };
  }

  async searchTransactions(reference?: string, name?: string) {
    const query = this.transactionRepository
      .createQueryBuilder('transaction')
      .orderBy('transaction.dateCreated', 'DESC')
      .take(200);

    const referenceQuery = reference?.trim();
    const nameQuery = name?.trim();

    if (referenceQuery) {
      query.andWhere(
        '(transaction.customerReference ILIKE :reference OR transaction.providerReference ILIKE :reference)',
        { reference: this.contains(referenceQuery) },
      );
    }

    if (nameQuery) {
      query.andWhere('transaction.accountName ILIKE :name', {
        name: this.contains(nameQuery),
      });
    }

    const transactions = await query.getMany();

    return {
      statusCode: 200,
      message: 'success',
      data: transactions.map((transaction) => ({
        id: transaction.id,
        beneficiaryId: transaction.beneficiaryId,
        accountName: transaction.accountName,
        accountNumber: transaction.accountNumber,
        bankName: transaction.bankName,
        amount: transaction.amount,
        status: transaction.status,
        customerReference: transaction.customerReference,
        providerReference: transaction.providerReference,
        providerMessage: transaction.providerMessage,
        dateCreated: transaction.dateCreated,
        dateUpdated: transaction.dateUpdated,
      })),
    };
  }

  async findOne(id: string, apiOrigin: string) {
    const beneficiary = await this.getBeneficiaryOrFail(id);
    const url = `${this.getFrontendBaseUrl()}/beneficiary/${beneficiary.id}`;

    return {
      statusCode: 200,
      message: 'success',
      data: {
        ...beneficiary,
        url,
        qrImageUrl: `${apiOrigin}/api/qrcode/${beneficiary.id}/image`,
        qrCode: await this.createQrCode(url),
        hasSubmittedDetails: Boolean(beneficiary.accountNumber),
      },
    };
  }

  async renderQrImage(id: string): Promise<Buffer> {
    const beneficiary = await this.getBeneficiaryOrFail(id);
    const url = `${this.getFrontendBaseUrl()}/beneficiary/${beneficiary.id}`;

    return QRCode.toBuffer(url, {
      type: 'png',
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
    });
  }

  async submitDetails(id: string, submitBeneficiaryDto: SubmitBeneficiaryDto) {
    const beneficiary = await this.getBeneficiaryOrFail(id);

    if (beneficiary.accountNumber) {
      throw new ConflictException('This QR code has already been used');
    }

    const existingAccount = await this.beneficiaryRepository.findOne({
      where: { accountNumber: submitBeneficiaryDto.accountNumber },
    });

    if (existingAccount) {
      throw new ConflictException(
        'This account number has already been registered',
      );
    }

    try {
      const updateResult = await this.beneficiaryRepository
        .createQueryBuilder()
        .update(Beneficiary)
        .set({
          accountName: submitBeneficiaryDto.accountName,
          accountNumber: submitBeneficiaryDto.accountNumber,
          bankName: submitBeneficiaryDto.bankName,
        })
        .where('id = :id', { id })
        .andWhere('"accountNumber" IS NULL')
        .execute();

      if (!updateResult.affected) {
        throw new ConflictException('This QR code has already been used');
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'This account number has already been registered',
        );
      }
      throw new InternalServerErrorException(
        'Unable to save beneficiary details',
      );
    }

    const updated = await this.getBeneficiaryOrFail(id);
    await this.enqueuePayout(updated.id);

    return {
      statusCode: 200,
      message: 'Beneficiary details saved. Payout has been queued.',
      data: updated,
    };
  }

  async listBanks(searchTerm?: string) {
    try {
      const banks = await this.fintavaService.getBanks(searchTerm);

      return {
        statusCode: 200,
        message: 'success',
        data: banks,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to fetch banks';
      throw new HttpException(message, HttpStatus.BAD_GATEWAY);
    }
  }

  async updatePaymentStatus(
    id: string,
    updatePaymentStatusDto: UpdatePaymentStatusDto,
  ) {
    const beneficiary = await this.getBeneficiaryOrFail(id);

    if (updatePaymentStatusDto.isPaid) {
      throw new BadRequestException(
        'Payment is marked paid only after the Fintava webhook confirms the transfer',
      );
    }

    if (!beneficiary.accountNumber) {
      throw new BadRequestException(
        'Account details must be submitted before payment status can change',
      );
    }

    beneficiary.isPaid = false;
    const updated = await this.beneficiaryRepository.save(beneficiary);

    return {
      statusCode: 200,
      message: 'Payment status updated',
      data: updated,
    };
  }

  async enqueueFintavaWebhook(payload: FintavaWebhookDto) {
    await this.webhookQueue.add('apply', payload, {
      attempts: 8,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: false,
      removeOnFail: false,
    });

    return {
      statusCode: 200,
      message: 'Fintava webhook queued',
    };
  }

  private async enqueuePayout(beneficiaryId: string): Promise<void> {
    try {
      await this.payoutQueue.add(
        'payout',
        { beneficiaryId },
        {
          jobId: `payout-${beneficiaryId}`,
          attempts: 5,
          backoff: { type: 'exponential', delay: 15000 },
          removeOnComplete: false,
          removeOnFail: false,
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (/already exists|duplicate/i.test(message)) {
        return;
      }
      throw error;
    }
  }

  private async getBeneficiaryOrFail(id: string): Promise<Beneficiary> {
    const beneficiary = await this.beneficiaryRepository.findOne({
      where: { id },
    });

    if (!beneficiary) {
      throw new NotFoundException('Beneficiary not found');
    }

    return beneficiary;
  }

  private getFrontendBaseUrl(): string {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL')?.trim();

    if (!frontendUrl) {
      throw new InternalServerErrorException('FRONTEND_URL is not configured');
    }

    return frontendUrl.replace(/\/$/, '');
  }

  private createQrCode(url: string): Promise<string> {
    return QRCode.toDataURL(url, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
    });
  }

  private contains(value: string): string {
    return `%${value.replace(/[%_\\]/g, '')}%`;
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'driverError' in error &&
      (error as { driverError?: { code?: string } }).driverError?.code ===
        '23505'
    );
  }
}
