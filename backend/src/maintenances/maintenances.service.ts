import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Maintenance, MAINTENANCE_TRANSITIONS, MaintenanceStatus } from './maintenance.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Incident, IncidentStatus } from '../incidents/incident.entity';
import { VehicleStatusService } from '../vehicles/vehicle-status.service';
import { CreateMaintenanceDto, MaintenanceQueryDto, UpdateMaintenanceDto } from './maintenance.dto';
import { localDate } from '../common/dates';

const TERMINAL = [MaintenanceStatus.COMPLETADA, MaintenanceStatus.CANCELADA];
/** Campos que se pueden corregir en una mantención ya cerrada (p. ej. llega la factura después). */
const EDITABLE_WHEN_CLOSED: (keyof UpdateMaintenanceDto)[] = ['cost', 'description'];

// Fecha local de Chile (ver common/dates.ts): con UTC, de noche ya era "mañana".
const today = () => localDate();

@Injectable()
export class MaintenancesService {
  constructor(
    @InjectRepository(Maintenance) private repo: Repository<Maintenance>,
    @InjectRepository(Vehicle) private vehicles: Repository<Vehicle>,
    @InjectRepository(Incident) private incidents: Repository<Incident>,
    private vehicleStatus: VehicleStatusService,
  ) {}

  async create(dto: CreateMaintenanceDto) {
    const vehicle = await this.vehicles.findOne({ where: { id: dto.vehicleId } });
    if (!vehicle) throw new NotFoundException('Vehículo no encontrado');
    const { vehicleId, ...rest } = dto;
    const m = this.repo.create({ ...rest, vehicle });
    if (m.status === MaintenanceStatus.COMPLETADA) {
      m.completedDate = m.completedDate ?? today();
      this.assertDates(m);
    }
    const saved = await this.repo.save(m);
    await this.vehicleStatus.recompute(vehicle.id, { releaseOutOfService: saved.status === MaintenanceStatus.COMPLETADA });
    return saved;
  }

  findAll(q: MaintenanceQueryDto = {}) {
    return this.repo.find({
      where: {
        ...(q.vehicleId && { vehicle: { id: q.vehicleId } }),
        ...(q.status && { status: q.status }),
        ...(q.type && { type: q.type }),
      },
      relations: ['vehicle'],
      order: { scheduledDate: 'DESC' },
    });
  }

  async findOne(id: string) {
    const m = await this.repo.findOne({ where: { id }, relations: ['vehicle'] });
    if (!m) throw new NotFoundException('Mantención no encontrada');
    return m;
  }

  async update(id: string, dto: UpdateMaintenanceDto) {
    const m = await this.findOne(id);
    const previous = m.status;
    const statusChanges = dto.status !== undefined && dto.status !== previous;

    if (TERMINAL.includes(previous)) {
      const forbidden = Object.keys(dto).filter((k) => !EDITABLE_WHEN_CLOSED.includes(k as keyof UpdateMaintenanceDto) && !(k === 'status' && !statusChanges));
      if (forbidden.length) {
        throw new ConflictException(`La mantención está ${previous}; solo se puede corregir: ${EDITABLE_WHEN_CLOSED.join(', ')}`);
      }
    }
    if (statusChanges && !MAINTENANCE_TRANSITIONS[previous].includes(dto.status!)) {
      throw new ConflictException(`Transición no permitida: ${previous} → ${dto.status}`);
    }

    Object.assign(m, dto);
    if (m.status === MaintenanceStatus.COMPLETADA && !m.completedDate) m.completedDate = today();
    this.assertDates(m);
    const saved = await this.repo.save(m);

    if (statusChanges) await this.afterStatusChange(saved);
    return saved;
  }

  async remove(id: string) {
    const m = await this.findOne(id);
    // Las incidencias que esperaban esta mantención vuelven a quedar abiertas.
    await this.incidents.update({ maintenance: { id }, status: IncidentStatus.EN_ATENCION }, { status: IncidentStatus.ABIERTA });
    await this.repo.remove(m);
    await this.vehicleStatus.recompute(m.vehicle.id);
    return { deleted: true };
  }

  // Costos acumulados por vehículo (insumo para el dashboard). Las canceladas no cuentan.
  async costsByVehicle() {
    const rows = await this.repo
      .createQueryBuilder('m')
      .innerJoin('m.vehicle', 'v')
      .select('v.id', 'vehicleId')
      .addSelect('v.plate', 'plate')
      .addSelect('COALESCE(SUM(m.cost), 0)', 'totalCost')
      .addSelect('COUNT(m.id)', 'maintenances')
      .where('m.status != :cancelled', { cancelled: MaintenanceStatus.CANCELADA })
      .groupBy('v.id')
      .addGroupBy('v.plate')
      .orderBy('"totalCost"', 'DESC')
      .getRawMany();
    // PostgreSQL devuelve SUM/COUNT como texto: se convierten a número para el frontend.
    return rows.map((r) => ({ ...r, totalCost: +r.totalCost, maintenances: +r.maintenances }));
  }

  /**
   * Efectos de un cambio de estado:
   *  - completada: las incidencias asociadas pasan a resuelta.
   *  - cancelada:  las incidencias asociadas vuelven a abierta.
   *  - siempre: se recalcula el estado del vehículo.
   */
  private async afterStatusChange(m: Maintenance) {
    if (m.status === MaintenanceStatus.COMPLETADA) {
      await this.incidents.update(
        { maintenance: { id: m.id }, status: IncidentStatus.EN_ATENCION },
        { status: IncidentStatus.RESUELTA, resolvedAt: new Date(), resolution: `Resuelta mediante mantención completada el ${m.completedDate}` },
      );
    } else if (m.status === MaintenanceStatus.CANCELADA) {
      await this.incidents.update({ maintenance: { id: m.id }, status: IncidentStatus.EN_ATENCION }, { status: IncidentStatus.ABIERTA });
    }
    await this.vehicleStatus.recompute(m.vehicle.id, { releaseOutOfService: m.status === MaintenanceStatus.COMPLETADA });
  }

  private assertDates(m: Maintenance) {
    // (Se permite terminar antes de la fecha programada: un adelanto es normal.)
    if (m.completedDate && m.completedDate > today()) {
      throw new BadRequestException('La fecha de término no puede estar en el futuro');
    }
  }
}
