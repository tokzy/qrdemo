import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('beneficiaries')
export class Beneficiary {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  accountName: string;

  @Column({ type: 'varchar', length: 10, nullable: true, unique: true })
  accountNumber: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  bankName: string;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: {
      to: (value: number) => value,
      from: (value: string) =>
        value === null || value === undefined ? null : parseFloat(value),
    },
  })
  amount: number;

  @Column({ type: 'boolean', default: false })
  isPaid: boolean;

  @CreateDateColumn({ name: 'dateCreated' })
  dateCreated: Date;

  @UpdateDateColumn({ name: 'dateUpdated' })
  dateUpdated: Date;
}
