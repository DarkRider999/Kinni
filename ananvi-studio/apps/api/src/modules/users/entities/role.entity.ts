import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable } from 'typeorm';
import { UserRole } from '@ananvi/shared';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: UserRole, unique: true })
  name: UserRole;

  @Column({ length: 255, nullable: true })
  description: string | null;
}
