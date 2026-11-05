import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { PaymentStatus } from '@ananvi/shared';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  user_id: string;

  @Column({ length: 255, unique: true })
  dodo_payment_id: string;

  @Column('int')
  amount_cents: number;

  @Column({ length: 3, default: 'USD' })
  currency: string;

  @Column('int')
  credits_granted: number;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column('jsonb', { default: '{}' })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  created_at: Date;
}
