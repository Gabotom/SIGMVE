import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Incident, IncidentSeverity, IncidentStatus, OPEN_INCIDENT_STATUSES } from './incident.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { VehicleStatusService } from '../vehicles/vehicle-status.service';
import { MaintenancesService } from '../maintenances/maintenances.service';
import { MaintenanceType } from '../maintenances/maintenance.entity';
import { AuthUser } from '../common/current-user.decorator';
import {
  ChangeIncidentStatusDto,
  CreateIncidentDto,
  CreateMaintenanceFromIncidentDto,
  IncidentQueryDto,
  UpdateIncidentDto,
} from './incident.dto';

/**
 * Máquina de estados de una incidencia:
 *   abierta ──► en_atencion ──► resuelta
 *      │  ▲          │
 *      │  └──────────┘ (si se cancela la mantención asociada)
 *      ├──► resuelta
 *      └──► descartada            (resuelta y descartada son finales)
 */
export const INCIDENT_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  [IncidentStatus.ABIERTA]: [IncidentStatus.EN_ATENCION, IncidentStatus.RESUELTA, IncidentStatus.DESCARTADA],
  [IncidentStatus.EN_ATENCION]: [IncidentStatus.ABIERTA, IncidentStatus.RESUELTA, IncidentStatus.DESCARTADA],
  [IncidentStatus.RESUELTA]: [],
  [IncidentStatus.DESCARTADA]: [],
};

const SAFE_USER = { id: true, fullName: true, email: true } as const;

@Injectable()
export class IncidentsService {
  constructor(
    @InjectRepository(Incident) private repo: Repository<Incident>,
    @InjectRepository(Vehicle) private vehicles: Repository<Vehicle>,
    private vehicleStatus: VehicleStatusService,
    private maintenances: MaintenancesService,
  ) {}

  async create(dto: CreateIncidentDto, actor: AuthUser) {
    const vehicle = await this.vehicles.findOne({ where: { id: dto.vehicleId } });
    if (!vehicle) throw new NotFoundException('Vehículo no encontrado');

    const { vehicleId, ...rest } = dto;
    const saved = await this.repo.save(
      this.repo.create({ ...rest, vehicle, reportedBy: { id: actor.userId }, status: IncidentStatus.ABIERTA }),
    );

    if (dto.mileage !== undefined && dto.mileage > vehicle.mileage) {
      await this.vehicles.update(vehicle.id, { mileage: dto.mileage });
    }
    if (saved.severity === IncidentSeverity.CRITICA) await this.vehicleStatus.recompute(vehicle.id);
    return this.findOne(saved.id);
  }

  findAll(q: IncidentQueryDto = {}) {
    const status = q.open === 'true' ? In(OPEN_INCIDENT_STATUSES) : q.status;
    return this.repo.find({
      where: {
        ...(q.vehicleId && { vehicle: { id: q.vehicleId } }),
        ...(status && { status }),
        ...(q.severity && { severity: q.severity }),
      },
      relations: { vehicle: true, reportedBy: true },
      select: { reportedBy: SAFE_USER },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const i = await this.repo.findOne({
      where: { id },
      relations: { vehicle: true, reportedBy: true, resolvedBy: true, maintenance: true },
      select: { reportedBy: SAFE_USER, resolvedBy: SAFE_USER },
    });
    if (!i) throw new NotFoundException('Incidencia no encontrada');
    return i;
  }

  async update(id: string, dto: UpdateIncidentDto) {
    const i = await this.findOne(id);
    this.assertOpen(i);
    const wasCritical = i.severity === IncidentSeverity.CRITICA;
    Object.assign(i, dto);
    await this.repo.save(i);

    const isCritical = i.severity === IncidentSeverity.CRITICA;
    // Si deja de ser crítica, el vehículo puede volver a estar disponible.
    if (wasCritical !== isCritical) await this.vehicleStatus.recompute(i.vehicle.id, { releaseOutOfService: wasCritical });
    return this.findOne(id);
  }

  async changeStatus(id: string, dto: ChangeIncidentStatusDto, actor: AuthUser) {
    const i = await this.findOne(id);
    if (dto.status === i.status) return i;
    if (!INCIDENT_TRANSITIONS[i.status].includes(dto.status)) {
      throw new ConflictException(`Transición no permitida: ${i.status} → ${dto.status}`);
    }

    i.status = dto.status;
    if (dto.status === IncidentStatus.RESUELTA || dto.status === IncidentStatus.DESCARTADA) {
      i.resolution = dto.resolution!;
      i.resolvedAt = new Date();
      i.resolvedBy = { id: actor.userId } as any;
    }
    await this.repo.save(i);

    if (i.severity === IncidentSeverity.CRITICA) {
      const closed = !OPEN_INCIDENT_STATUSES.includes(i.status);
      await this.vehicleStatus.recompute(i.vehicle.id, { releaseOutOfService: closed });
    }
    return this.findOne(id);
  }

  /**
   * Flujo incidencia -> mantención correctiva. La incidencia queda en_atencion y,
   * cuando la mantención se complete, MaintenancesService la marcará como resuelta.
   */
  async createMaintenance(id: string, dto: CreateMaintenanceFromIncidentDto) {
    const i = await this.findOne(id);
    this.assertOpen(i);
    if (i.status === IncidentStatus.EN_ATENCION && i.maintenance) {
      throw new ConflictException('La incidencia ya tiene una mantención asociada en curso');
    }
    const maintenance = await this.maintenances.create({
      vehicleId: i.vehicle.id,
      type: MaintenanceType.CORRECTIVA,
      description: dto.description ?? `Incidencia: ${i.title}`,
      scheduledDate: dto.scheduledDate,
    });
    i.maintenance = maintenance;
    i.status = IncidentStatus.EN_ATENCION;
    await this.repo.save(i);
    return this.findOne(id);
  }

  async remove(id: string) {
    const i = await this.findOne(id);
    await this.repo.remove(i);
    if (i.severity === IncidentSeverity.CRITICA) await this.vehicleStatus.recompute(i.vehicle.id, { releaseOutOfService: true });
    return { deleted: true };
  }

  /** Para el dashboard: incidencias vivas por severidad y vehículos afectados. */
  async summary() {
    const rows = await this.repo
      .createQueryBuilder('i')
      .select('i.severity', 'severity')
      .addSelect('COUNT(*)', 'count')
      .where('i.status IN (:...open)', { open: OPEN_INCIDENT_STATUSES })
      .groupBy('i.severity')
      .getRawMany();
    const openBySeverity: Record<string, number> = {};
    Object.values(IncidentSeverity).forEach((s) => (openBySeverity[s] = 0));
    rows.forEach((r) => (openBySeverity[r.severity] = +r.count));

    const affected = await this.repo
      .createQueryBuilder('i')
      .select('COUNT(DISTINCT i.vehicleId)', 'n')
      .where('i.status IN (:...open)', { open: OPEN_INCIDENT_STATUSES })
      .getRawOne();

    return {
      totalOpen: Object.values(openBySeverity).reduce((a, b) => a + b, 0),
      openBySeverity,
      vehiclesWithOpenIncidents: +(affected?.n ?? 0),
    };
  }

  private assertOpen(i: Incident) {
    if (!OPEN_INCIDENT_STATUSES.includes(i.status)) {
      throw new ConflictException(`La incidencia está ${i.status} y ya no se puede modificar`);
    }
  }
}
