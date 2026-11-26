import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  user_id: string;

  @Column({ length: 100 })
  action: string;

  @Column({ length: 50 })
  resource_type: string;

  @Column({ length: 255, nullable: true })
  resource_id: string | null;

  @Column({ length: 45 })
  ip_address: string;

  @Column({ length: 512, default: '' })
  user_agent: string;

  @Column('jsonb', { default: '{}' })
  details: Record<string, unknown>;

  @CreateDateColumn()
  created_at: Date;
}
