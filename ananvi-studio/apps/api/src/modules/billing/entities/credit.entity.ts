import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('credits')
export class Credit {
  @PrimaryColumn('uuid')
  user_id: string;

  @Column({ type: 'int', default: 0 })
  balance: number;

  @Column({ type: 'int', default: 0 })
  lifetime_purchased: number;

  @Column({ type: 'int', default: 0 })
  lifetime_used: number;

  @UpdateDateColumn()
  updated_at: Date;
}
