import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { CreditTransactionType } from '@ananvi/shared';

@Entity('credit_transactions')
export class CreditTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  user_id: string;

  @Column({ type: 'enum', enum: CreditTransactionType })
  type: CreditTransactionType;

  @Column('int')
  amount: number;

  @Column('int')
  balance_after: number;

  @Column({ length: 500 })
  description: string;

  @Column({ length: 255, nullable: true })
  reference_id: string | null;

  @CreateDateColumn()
  created_at: Date;
}
