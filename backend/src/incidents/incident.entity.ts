import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Vehicle } from '../vehicles/vehicle.entity';
import { User } from '../users/user.entity';
import { Maintenance } from '../maintenances/maintenance.entity';

export enum IncidentSeverity { BAJA = 'baja', MEDIA = 'media', ALTA = 'alta', CRITICA = 'critica' }
export enum IncidentStatus { ABIERTA = 'abierta', EN_ATENCION = 'en_atencion', RESUELTA = 'resuelta', DESCARTADA = 'descartada' }

/** Estados en que la incidencia sigue "viva" (cuenta para disponibilidad y dashboard). */
export const OPEN_INCIDENT_STATUSES = [IncidentStatus.ABIERTA, IncidentStatus.EN_ATENCION];

@Entity('incidents')
export class Incident {
  @PrimaryGeneratedColumn('uuid') id: string;

  // RESTRICT: no se puede borrar un vehículo con incidencias (se pierde trazabilidad).
  @ManyToOne(() => Vehicle, { nullable: false, onDelete: 'RESTRICT' }) vehicle: Vehicle;

  @Column({ length: 150 }) title: string;
  @Column({ type: 'text' }) description: string;
  @Column({ type: 'enum', enum: IncidentSeverity }) severity: IncidentSeverity;
  @Column({ type: 'enum', enum: IncidentStatus, default: IncidentStatus.ABIERTA }) status: IncidentStatus;

  /** Kilometraje del vehículo al momento del reporte (opcional). */
  @Column({ type: 'int', nullable: true }) mileage: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL', eager: false }) reportedBy: User | null;

  /** Mantención correctiva generada a partir de esta incidencia. */
  @ManyToOne(() => Maintenance, { nullable: true, onDelete: 'SET NULL' }) maintenance: Maintenance | null;

  @Column({ type: 'text', nullable: true }) resolution: string | null;
  @Column({ type: 'timestamptz', nullable: true }) resolvedAt: Date | null;
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' }) resolvedBy: User | null;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
