import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Role } from '../common/roles';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ unique: true }) email: string;
  // select:false -> el hash nunca sale en consultas normales; solo se pide explícitamente para el login.
  @Column({ select: false }) passwordHash: string;
  @Column() fullName: string;
  @Column({ type: 'enum', enum: Role, default: Role.VIEWER }) role: Role;
  // Desactivar en vez de borrar: se conserva la trazabilidad (quién reportó, quién registró).
  @Column({ default: true }) active: boolean;
  @Column({ type: 'timestamptz', nullable: true }) lastLoginAt: Date | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
