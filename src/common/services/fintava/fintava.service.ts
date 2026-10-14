import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import {
  FintavaBank,
  FintavaTransactionLookup,
  FintavaTransactionState,
  FintavaTransferPayload,
  FintavaTransferResult,
} from './fintava.types';

@Injectable()
export class FintavaService {
  private readonly logger = new Logger(FintavaService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async getBanks(searchTerm?: string): Promise<FintavaBank[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl()}/banks`, {
          headers: this.authHeaders(),
          params: {
            order: 'ASC',
            ...(searchTerm ? { searchTerm } : {}),
          },
        }),
      );

      const banks = response.data?.data;
      if (!Array.isArray(banks)) {
        throw new Error(
          response.data?.message || 'Fintava did not return a bank list',
        );
      }

      return banks;
    } catch (error) {
      if (error instanceof AxiosError) {
        throw new Error(
          error.response?.data?.message || 'Unable to fetch Fintava banks',
        );
      }
      throw error;
    }
  }

  async resolveSortCode(bankName: string): Promise<string> {
    const searched = await this.getBanks(bankName);
    const searchedMatch = this.pickBank(bankName, searched);
    if (searchedMatch) {
      return searchedMatch.code;
    }

    const allBanks = await this.getBanks();
    const fallback = this.pickBank(bankName, allBanks);
    if (!fallback) {
      throw new Error(`No Fintava bank matches "${bankName}"`);
    }

    return fallback.code;
  }

  async transfer(
    payload: FintavaTransferPayload,
  ): Promise<FintavaTransferResult> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl()}/bank/credit/merchant`,
          payload,
          { headers: this.authHeaders() },
        ),
      );

      const body = this.asRecord(response.data);
      return {
        httpStatus: response.status,
        message: this.readMessage(response.data) || 'Transfer request accepted',
        reference: this.extractReference(body),
        body,
      };
    } catch (error) {
      if (error instanceof AxiosError && error.response) {
        this.logger.warn(
          `Fintava transfer request returned ${error.response.status}`,
        );
        const body = this.asRecord(error.response.data);
        return {
          httpStatus: error.response.status,
          message:
            this.readMessage(error.response.data) ||
            'Fintava rejected the transfer request',
          reference: this.extractReference(body),
          body,
        };
      }
      throw error;
    }
  }

  classifyTransferStatus(status?: string): FintavaTransactionState {
    return this.classifyStatus(status);
  }

  async getTransactionByReference(
    reference: string,
  ): Promise<FintavaTransactionLookup> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl()}/transaction/reference/${encodeURIComponent(reference)}`,
          { headers: this.authHeaders() },
        ),
      );

      return this.toLookup(response.data);
    } catch (error) {
      if (error instanceof AxiosError && error.response) {
        const message =
          this.readMessage(error.response.data) ||
          'Unable to validate the Fintava transaction';
        if (
          error.response.status === 404 ||
          /not found|no transaction|does not exist/i.test(message)
        ) {
          return {
            state: 'not_found',
            message,
            body: this.asRecord(error.response.data),
          };
        }
        throw new Error(message);
      }
      throw error;
    }
  }

  private pickBank(bankName: string, banks: FintavaBank[]): FintavaBank | null {
    const ranked = banks
      .map((bank) => ({ bank, score: this.scoreBank(bankName, bank.name) }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score);

    if (!ranked.length) {
      return null;
    }

    if (ranked.length > 1 && ranked[0].score === ranked[1].score) {
      throw new Error(`More than one Fintava bank matches "${bankName}"`);
    }

    return ranked[0].bank;
  }

  private scoreBank(query: string, bankName: string): number {
    const left = this.normalize(query);
    const right = this.normalize(bankName);

    if (!left || !right) {
      return 0;
    }
    if (left === right) {
      return 100;
    }
    if (right.startsWith(left) || left.startsWith(right)) {
      return 80;
    }
    if (right.includes(left) || left.includes(right)) {
      return 60;
    }
    return 0;
  }

  private normalize(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private toLookup(body: unknown): FintavaTransactionLookup {
    const record = this.asRecord(body);
    const transaction = this.readTransaction(record);
    const status = this.readStatus(transaction);
    const reference = this.readReference(transaction);
    const message =
      this.readMessage(record) ||
      (status
        ? `Fintava status is ${status}`
        : 'Fintava transaction was not found');

    if (!transaction || (!status && !reference)) {
      return {
        state: /pending|processing/i.test(message) ? 'pending' : 'not_found',
        message,
        body: record,
      };
    }

    return {
      state: this.classifyStatus(status),
      status,
      message,
      reference,
      body: record,
    };
  }

  private readTransaction(
    body: Record<string, unknown> | null,
  ): Record<string, unknown> | null {
    if (!body) {
      return null;
    }

    if (Array.isArray(body.data)) {
      return this.asRecord(body.data[0]);
    }

    const data = this.asRecord(body.data);
    if (data && (data.status || data.reference || data.transType)) {
      return data;
    }

    if (typeof body.status === 'string' || typeof body.reference === 'string') {
      return body;
    }

    return data;
  }

  private readStatus(transaction: Record<string, unknown> | null): string | undefined {
    const status = transaction?.status;
    return typeof status === 'string' ? status : undefined;
  }

  private classifyStatus(status?: string): FintavaTransactionState {
    if (!status) {
      return 'pending';
    }

    const normalized = status.trim().toLowerCase();
    if (['success', 'successful', 'completed', 'approved'].includes(normalized)) {
      return 'successful';
    }
    if (
      ['failed', 'fail', 'failure', 'declined', 'cancelled', 'canceled', 'reversed'].includes(
        normalized,
      )
    ) {
      return 'failed';
    }

    return 'pending';
  }

  private extractReference(
    body: Record<string, unknown> | null,
  ): string | undefined {
    if (!body) {
      return undefined;
    }

    const direct = this.readReference(body);
    if (direct) {
      return direct;
    }

    if (typeof body.data === 'string' && body.data.trim()) {
      return body.data.trim();
    }

    if (Array.isArray(body.data)) {
      return this.readReference(this.asRecord(body.data[0]));
    }

    return this.readReference(this.asRecord(body.data));
  }

  private readReference(body: Record<string, unknown> | null): string | undefined {
    if (!body) {
      return undefined;
    }

    const candidates = [
      body.reference,
      body.referenceId,
      body.Reference,
      body.transactionReference,
      body.TransRef,
      body.transRef,
      body.transactionId,
      body.id,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }

    return undefined;
  }

  private readMessage(body: unknown): string {
    const record = this.asRecord(body);
    const message = record?.message;

    if (typeof message === 'string') {
      return message;
    }

    if (Array.isArray(message)) {
      return message.filter((item) => typeof item === 'string').join(' ');
    }

    return '';
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }

  private baseUrl(): string {
    const baseUrl = this.configService.get<string>('fintavaBaseUrl')?.trim();
    if (!baseUrl) {
      throw new Error('fintavaBaseUrl is not configured');
    }
    return baseUrl.replace(/\/$/, '');
  }

  private authHeaders(): Record<string, string> {
    const apiKey = this.configService.get<string>('fintavaApiKey')?.trim();
    if (!apiKey) {
      throw new Error('fintavaApiKey is not configured');
    }

    return {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };
  }
}
