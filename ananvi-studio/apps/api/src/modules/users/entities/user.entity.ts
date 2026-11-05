import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToMany, JoinTable, OneToOne,
} from 'typeorm';
import { Role } from './role.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ unique: true, length: 50 })
  username: string;

  @Column({ length: 255 })
  password_hash: string;

  @Column({ length: 100, nullable: true })
  display_name: string | null;

  @Column({ length: 512, nullable: true })
  avatar_url: string | null;

  @Column({ default: true })
  is_active: boolean;

  @Column({ default: false })
  is_email_verified: boolean;

  @Column({ length: 255, nullable: true })
  totp_secret: string | null;

  @Column({ default: false })
  totp_enabled: boolean;

  @Column({ length: 255, nullable: true })
  reset_token: string | null;

  @Column({ type: 'timestamp', nullable: true })
  reset_token_expires: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  last_login_at: Date | null;

  @Column({ type: 'jsonb', nullable: true, default: '{}' })
  notification_prefs: Record<string, boolean> | null;

  @ManyToMany(() => Role, { eager: true })
  @JoinTable({
    name: 'user_roles',
    joinColumn: { name: 'user_id' },
    inverseJoinColumn: { name: 'role_id' },
  })
  roles: Role[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
