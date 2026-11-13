import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Vehicle } from '../vehicles/vehicle.entity';

export enum MaintenanceType { PREVENTIVA = 'preventiva', CORRECTIVA = 'correctiva' }
export enum MaintenanceStatus { PROGRAMADA = 'programada', EN_PROCESO = 'en_proceso', COMPLETADA = 'completada', CANCELADA = 'cancelada' }

/**
 * Transiciones de estado permitidas (máquina de estados).
 * completada y cancelada son finales: una mantención cerrada no se "reabre".
 */
export const MAINTENANCE_TRANSITIONS: Record<MaintenanceStatus, MaintenanceStatus[]> = {
  [MaintenanceStatus.PROGRAMADA]: [MaintenanceStatus.EN_PROCESO, MaintenanceStatus.COMPLETADA, MaintenanceStatus.CANCELADA],
  [MaintenanceStatus.EN_PROCESO]: [MaintenanceStatus.COMPLETADA, MaintenanceStatus.CANCELADA],
  [MaintenanceStatus.COMPLETADA]: [],
  [MaintenanceStatus.CANCELADA]: [],
};

@Entity('maintenances')
export class Maintenance {
  @PrimaryGeneratedColumn('uuid') id: string;
  // RESTRICT: antes era CASCADE y borrar un vehículo eliminaba todo su historial de mantenciones.
  @ManyToOne(() => Vehicle, (v) => v.maintenances, { onDelete: 'RESTRICT', nullable: false }) vehicle: Vehicle;
  @Column({ type: 'enum', enum: MaintenanceType }) type: MaintenanceType;
  @Column() description: string;
  @Column({ type: 'date' }) scheduledDate: string;
  @Column({ type: 'date', nullable: true }) completedDate: string;
  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, transformer: { to: (v) => v, from: (v) => (v === null ? null : parseFloat(v)) } }) cost: number;
  @Column({ type: 'enum', enum: MaintenanceStatus, default: MaintenanceStatus.PROGRAMADA }) status: MaintenanceStatus;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
