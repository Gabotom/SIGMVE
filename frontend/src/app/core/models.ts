/** Tipos que devuelve la API de SIGMVE (mismos valores que los enum del backend). */

export type Role = 'admin' | 'operator' | 'viewer';
export type VehicleType = 'bomba' | 'ambulancia' | 'rescate' | 'patrulla' | 'otro';
export type VehicleStatus = 'disponible' | 'en_emergencia' | 'en_mantencion' | 'fuera_de_servicio';
export type MaintenanceType = 'preventiva' | 'correctiva';
export type MaintenanceStatus = 'programada' | 'en_proceso' | 'completada' | 'cancelada';
export type IncidentSeverity = 'baja' | 'media' | 'alta' | 'critica';
export type IncidentStatus = 'abierta' | 'en_atencion' | 'resuelta' | 'descartada';
export type AlertType = 'mantencion_vencida' | 'mantencion_proxima' | 'incidencia_critica' | 'incidencia_sin_atender' | 'baja_disponibilidad';
export type AlertSeverity = 'info' | 'advertencia' | 'critica';
export type AlertStatus = 'activa' | 'reconocida' | 'resuelta';

export interface UserRef { id: string; fullName: string; email: string }

export interface User extends UserRef {
  role: Role;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface LoginResponse {
  accessToken: string;
  user: { id: string; email: string; fullName: string; role: Role };
}

export interface Vehicle {
  id: string;
  plate: string;
  type: VehicleType;
  brand: string;
  model: string;
  year: number;
  station: string | null;
  mileage: number;
  status: VehicleStatus;
  createdAt: string;
  updatedAt: string;
  maintenances?: Maintenance[];
}

export interface Maintenance {
  id: string;
  vehicle?: Vehicle;
  type: MaintenanceType;
  description: string;
  scheduledDate: string;
  completedDate: string | null;
  cost: number;
  status: MaintenanceStatus;
  createdAt: string;
}

export interface Incident {
  id: string;
  vehicle: Vehicle;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  mileage: number | null;
  reportedBy: UserRef | null;
  maintenance?: Maintenance | null;
  resolution: string | null;
  resolvedAt: string | null;
  resolvedBy?: UserRef | null;
  createdAt: string;
}

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  sourceKey: string;
  title: string;
  detail: string;
  vehicle: Pick<Vehicle, 'id' | 'plate' | 'type' | 'station' | 'status'> | null;
  acknowledgedAt: string | null;
  acknowledgedBy: UserRef | null;
  acknowledgeNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface VehicleSummary { total: number; byStatus: Record<VehicleStatus, number>; availabilityPct: number }
export interface IncidentSummary { totalOpen: number; openBySeverity: Record<IncidentSeverity, number>; vehiclesWithOpenIncidents: number }
export interface AlertSummary {
  total: number;
  unacknowledged: number;
  bySeverity: Record<AlertSeverity, number>;
  byType: Record<AlertType, number>;
  lastEvaluatedAt: string | null;
}
export interface VehicleCost { vehicleId: string; plate: string; totalCost: number; maintenances: number }
