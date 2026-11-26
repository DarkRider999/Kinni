import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, OneToMany,
} from 'typeorm';
import { Job } from '../../jobs/entities/job.entity';
import { Caption } from './caption.entity';

@Entity('clips')
export class Clip {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  job_id: string;

  @Column('uuid')
  user_id: string;

  @ManyToOne(() => Job)
  @JoinColumn({ name: 'job_id' })
  job: Job;

  @Column({ length: 255 })
  title: string;

  @Column('float')
  start_time: number;

  @Column('float')
  end_time: number;

  @Column('float')
  duration: number;

  @Column('float', { default: 0 })
  hook_score: number;

  @Column('float', { default: 0 })
  flow_score: number;

  @Column('float', { default: 0 })
  value_score: number;

  @Column('float', { default: 0 })
  overall_score: number;

  @Column({ length: 1024 })
  video_s3_key: string;

  @Column({ length: 1024, nullable: true })
  thumbnail_s3_key: string;

  @Column({ default: false })
  is_favorite: boolean;

  @Column({ type: 'int', default: 0 })
  export_count: number;

  @OneToMany(() => Caption, c => c.clip, { cascade: true })
  captions: Caption[];

  @CreateDateColumn()
  created_at: Date;
}
