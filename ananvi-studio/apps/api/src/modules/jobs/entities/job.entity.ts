import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { JobStatus, CaptionStyle, AIVideoStyle } from '@ananvi/shared';

@Entity('jobs')
export class Job {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  user_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ length: 2048 })
  source_url: string;

  @Column({ length: 20, default: 'youtube' })
  source_platform: string;

  @Column({ type: 'int', default: 0 })
  source_duration_seconds: number;

  @Column({ type: 'int', default: 0 })
  credits_charged: number;

  @Column({ type: 'enum', enum: JobStatus, default: JobStatus.QUEUED })
  status: JobStatus;

  @Column({ type: 'int', default: 10 })
  clip_count: number;

  @Column({ type: 'enum', enum: CaptionStyle, default: CaptionStyle.EXCITED })
  caption_style: CaptionStyle;

  @Column({ length: 10, default: 'en' })
  caption_language: string;

  @Column({ type: 'enum', enum: AIVideoStyle, nullable: true })
  ai_video_style: AIVideoStyle | null;

  @Column({ type: 'smallint', default: 0 })
  progress_percent: number;

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  @Column({ type: 'timestamp', nullable: true })
  started_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  completed_at: Date | null;

  @CreateDateColumn()
  created_at: Date;
}
