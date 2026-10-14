import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum TransactionStatus {
  QUEUED = 'queued',
  SUBMITTED = 'submitted',
  SUCCESSFUL = 'successful',
  FAILED = 'failed',
}

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  beneficiaryId: string;

  @Column({ type: 'varchar', length: 150 })
  accountName: string;

  @Column({ type: 'varchar', length: 10 })
  accountNumber: string;

  @Column({ type: 'varchar', length: 150 })
  bankName: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  sortCode: string;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) =>
        value === null || value === undefined ? null : parseFloat(value),
    },
  })
  amount: number;

  @Column({ type: 'varchar', length: 120 })
  narration: string;

  @Column({ type: 'varchar', length: 80, unique: true })
  customerReference: string;

  @Column({ type: 'varchar', length: 20 })
  status: TransactionStatus;

  @Column({ type: 'text', nullable: true })
  providerMessage: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  providerReference: string;

  @Column({ type: 'jsonb', nullable: true })
  providerResponse: Record<string, unknown>;

  @CreateDateColumn({ name: 'dateCreated' })
  dateCreated: Date;

  @UpdateDateColumn({ name: 'dateUpdated' })
  dateUpdated: Date;
}
