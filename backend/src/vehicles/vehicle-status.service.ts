import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Vehicle, VehicleStatus } from './vehicle.entity';
import { Maintenance, MaintenanceStatus } from '../maintenances/maintenance.entity';
import { Incident, IncidentSeverity, OPEN_INCIDENT_STATUSES } from '../incidents/incident.entity';

export interface StatusBlockers {
  /** Hay al menos una mantención en_proceso. */
  activeMaintenance: boolean;
  /** Hay al menos una incidencia crítica abierta o en atención. */
  openCriticalIncident: boolean;
}

/**
 * Única fuente de verdad sobre el estado de disponibilidad de un vehículo.
 * Mantenciones e incidencias llaman a recompute() después de cada cambio, en lugar de
 * modificar vehicle.status por su cuenta (que es lo que causaba inconsistencias).
 *
 * Prioridad:
 *   1. Mantención en proceso            -> en_mantencion
 *   2. Incidencia crítica abierta       -> fuera_de_servicio
 *   3. Sin bloqueos: si el vehículo estaba en_mantencion vuelve a disponible.
 *      Si estaba fuera_de_servicio, solo vuelve a disponible cuando el evento que llama
 *      "libera" el vehículo (mantención completada o incidencia crítica cerrada); así no se
 *      pisa un fuera_de_servicio puesto a mano por el operador por otro motivo.
 */
@Injectable()
export class VehicleStatusService {
  constructor(
    @InjectRepository(Vehicle) private vehicles: Repository<Vehicle>,
    @InjectRepository(Maintenance) private maintenances: Repository<Maintenance>,
    @InjectRepository(Incident) private incidents: Repository<Incident>,
  ) {}

  async blockers(vehicleId: string): Promise<StatusBlockers> {
    const [activeMaintenance, openCriticalIncident] = await Promise.all([
      this.maintenances.exists({ where: { vehicle: { id: vehicleId }, status: MaintenanceStatus.EN_PROCESO } }),
      this.incidents.exists({
        where: { vehicle: { id: vehicleId }, severity: IncidentSeverity.CRITICA, status: In(OPEN_INCIDENT_STATUSES) },
      }),
    ]);
    return { activeMaintenance, openCriticalIncident };
  }

  /** Estado que corresponde al vehículo dado su estado actual y sus bloqueos. Función pura (fácil de testear). */
  static resolve(current: VehicleStatus, b: StatusBlockers, releaseOutOfService: boolean): VehicleStatus {
    if (b.activeMaintenance) return VehicleStatus.EN_MANTENCION;
    if (b.openCriticalIncident) return VehicleStatus.FUERA_DE_SERVICIO;
    if (current === VehicleStatus.EN_MANTENCION) return VehicleStatus.DISPONIBLE;
    if (current === VehicleStatus.FUERA_DE_SERVICIO && releaseOutOfService) return VehicleStatus.DISPONIBLE;
    return current;
  }

  async recompute(vehicleId: string, opts: { releaseOutOfService?: boolean } = {}): Promise<Vehicle> {
    const vehicle = await this.vehicles.findOne({ where: { id: vehicleId } });
    if (!vehicle) throw new NotFoundException('Vehículo no encontrado');
    const next = VehicleStatusService.resolve(vehicle.status, await this.blockers(vehicleId), !!opts.releaseOutOfService);
    if (next !== vehicle.status) {
      vehicle.status = next;
      await this.vehicles.save(vehicle);
    }
    return vehicle;
  }
}
