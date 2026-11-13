import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Vehicle } from '../vehicles/vehicle.entity';
import { User } from '../users/user.entity';

export enum AlertType {
  /** Mantención programada cuya fecha ya pasó y no se ha iniciado. */
  MANTENCION_VENCIDA = 'mantencion_vencida',
  /** Mantención programada dentro de los próximos ALERT_UPCOMING_DAYS días. */
  MANTENCION_PROXIMA = 'mantencion_proxima',
  /** Incidencia crítica abierta sin mantención asignada. */
  INCIDENCIA_CRITICA = 'incidencia_critica',
  /** Incidencia no crítica abierta hace más de ALERT_INCIDENT_STALE_HOURS horas. */
  INCIDENCIA_SIN_ATENDER = 'incidencia_sin_atender',
  /** Porcentaje de la flota disponible bajo ALERT_MIN_AVAILABILITY_PCT. */
  BAJA_DISPONIBILIDAD = 'baja_disponibilidad',
}

// El orden importa: PostgreSQL ordena los enum según su declaración, así ORDER BY severity DESC deja las críticas primero.
export enum AlertSeverity { INFO = 'info', ADVERTENCIA = 'advertencia', CRITICA = 'critica' }
export const SEVERITY_RANK: Record<AlertSeverity, number> = { info: 0, advertencia: 1, critica: 2 };

export enum AlertStatus { ACTIVA = 'activa', RECONOCIDA = 'reconocida', RESUELTA = 'resuelta' }
/** Alertas "vivas": siguen cumpliéndose sus condiciones. */
export const LIVE_ALERT_STATUSES = [AlertStatus.ACTIVA, AlertStatus.RECONOCIDA];

/**
 * Alerta detectada por el motor de reglas (AlertsService.evaluate).
 * Se persiste para tener trazabilidad: cuándo se detectó, quién la reconoció y cuándo dejó de cumplirse.
 * El índice único parcial garantiza una sola alerta viva por condición (tipo + origen).
 */
@Entity('alerts')
@Index('UQ_alerts_live_source', ['type', 'sourceKey'], { unique: true, where: `"status" <> 'resuelta'` })
export class Alert {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'enum', enum: AlertType }) type: AlertType;
  @Column({ type: 'enum', enum: AlertSeverity }) severity: AlertSeverity;
  @Column({ type: 'enum', enum: AlertStatus, default: AlertStatus.ACTIVA }) status: AlertStatus;

  /** Qué originó la alerta: 'maintenance:<id>', 'incident:<id>' o 'flota'. */
  @Column({ length: 120 }) sourceKey: string;

  @Column({ length: 200 }) title: string;
  @Column({ type: 'text' }) detail: string;

  // Las alertas son datos derivados: si el vehículo se elimina, sus alertas también.
  @ManyToOne(() => Vehicle, { nullable: true, onDelete: 'CASCADE' }) vehicle: Vehicle | null;

  @Column({ type: 'timestamptz', nullable: true }) acknowledgedAt: Date | null;
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' }) acknowledgedBy: User | null;
  @Column({ type: 'text', nullable: true }) acknowledgeNote: string | null;

  /** Cuándo dejó de cumplirse la condición (la resuelve el sistema, no un usuario). */
  @Column({ type: 'timestamptz', nullable: true }) resolvedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}
