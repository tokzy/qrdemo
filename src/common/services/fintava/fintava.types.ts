export interface FintavaBank {
  id: string;
  code: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface FintavaTransferPayload {
  narration?: string;
  accountNumber: string;
  accountName: string;
  sortCode: string;
  amount: number;
  CustomerReference: string;
}

export interface FintavaTransferResult {
  httpStatus: number;
  message: string;
  reference?: string;
  body: Record<string, unknown> | null;
}

export type FintavaTransactionState =
  | 'successful'
  | 'failed'
  | 'pending'
  | 'not_found';

export interface FintavaTransactionLookup {
  state: FintavaTransactionState;
  status?: string;
  message: string;
  reference?: string;
  body: Record<string, unknown> | null;
}

export const FINTAVA_TRANSFER_QUEUE = 'fintava-transfer';
export const FINTAVA_WEBHOOK_QUEUE = 'fintava-webhook';
