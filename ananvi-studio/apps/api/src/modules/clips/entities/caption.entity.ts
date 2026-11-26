import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Clip } from './clip.entity';
import { CaptionStyle } from '@ananvi/shared';

@Entity('captions')
export class Caption {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  clip_id: string;

  @ManyToOne(() => Clip, c => c.captions)
  @JoinColumn({ name: 'clip_id' })
  clip: Clip;

  @Column({ length: 10 })
  language: string;

  @Column({ type: 'enum', enum: CaptionStyle })
  style: CaptionStyle;

  @Column('text')
  srt_content: string;

  @Column('text')
  vtt_content: string;

  @Column('jsonb', { default: '[]' })
  word_timestamps: { word: string; start: number; end: number; confidence: number }[];
}
