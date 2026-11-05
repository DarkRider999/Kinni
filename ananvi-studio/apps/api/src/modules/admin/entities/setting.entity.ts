import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('settings')
export class Setting {
  @PrimaryColumn({ length: 100 })
  key: string;

  @Column('text')
  value: string;

  @Column({ length: 255, nullable: true })
  description: string | null;

  @UpdateDateColumn()
  updated_at: Date;
}
