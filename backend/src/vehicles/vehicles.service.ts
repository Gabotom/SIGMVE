import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Not, Repository } from 'typeorm';
import { Vehicle, VehicleStatus } from './vehicle.entity';
import { CreateVehicleDto, UpdateVehicleDto, VehicleQueryDto } from './vehicle.dto';
import { Maintenance } from '../maintenances/maintenance.entity';
import { Incident } from '../incidents/incident.entity';
import { VehicleStatusService } from './vehicle-status.service';

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(Vehicle) private repo: Repository<Vehicle>,
    @InjectRepository(Maintenance) private maintenances: Repository<Maintenance>,
    @InjectRepository(Incident) private incidents: Repository<Incident>,
    private status: VehicleStatusService,
  ) {}

  async create(dto: CreateVehicleDto) {
    const plate = dto.plate.trim().toUpperCase();
    await this.assertPlateFree(plate);
    return this.repo.save(this.repo.create({ ...dto, plate }));
  }

  findAll(q: VehicleQueryDto = {}) {
    const qb = this.repo.createQueryBuilder('v').orderBy('v.plate', 'ASC');
    if (q.status) qb.andWhere('v.status = :status', { status: q.status });
    if (q.type) qb.andWhere('v.type = :type', { type: q.type });
    if (q.station) qb.andWhere('v.station ILIKE :station', { station: `%${q.station}%` });
    if (q.search) {
      qb.andWhere(new Brackets((w) => {
        w.where('v.plate ILIKE :s', { s: `%${q.search}%` })
          .orWhere('v.brand ILIKE :s')
          .orWhere('v.model ILIKE :s');
      }));
    }
    return qb.getMany();
  }

  async findOne(id: string) {
    const v = await this.repo.findOne({ where: { id }, relations: ['maintenances'], order: { maintenances: { scheduledDate: 'DESC' } } });
    if (!v) throw new NotFoundException('Vehículo no encontrado');
    return v;
  }

  async update(id: string, dto: UpdateVehicleDto) {
    const v = await this.repo.findOne({ where: { id } });
    if (!v) throw new NotFoundException('Vehículo no encontrado');

    if (dto.plate) {
      dto.plate = dto.plate.trim().toUpperCase();
      if (dto.plate !== v.plate) await this.assertPlateFree(dto.plate, id);
    }
    if (dto.mileage !== undefined && dto.mileage < v.mileage) {
      throw new BadRequestException(`El kilometraje no puede disminuir (actual: ${v.mileage})`);
    }
    if (dto.status && dto.status !== v.status) await this.assertManualStatusAllowed(id, dto.status);

    Object.assign(v, dto);
    return this.repo.save(v);
  }

  /** Un vehículo con historial no se borra: se marca fuera_de_servicio para conservar la trazabilidad. */
  async remove(id: string) {
    const v = await this.repo.findOne({ where: { id } });
    if (!v) throw new NotFoundException('Vehículo no encontrado');
    const [m, i] = await Promise.all([
      this.maintenances.count({ where: { vehicle: { id } } }),
      this.incidents.count({ where: { vehicle: { id } } }),
    ]);
    if (m + i > 0) {
      throw new ConflictException(
        `El vehículo tiene historial (${m} mantenciones, ${i} incidencias). Márcalo como fuera_de_servicio en lugar de eliminarlo`,
      );
    }
    await this.repo.remove(v);
    return { deleted: true };
  }

  // Resumen para el dashboard operacional
  async summary() {
    const rows = await this.repo
      .createQueryBuilder('v')
      .select('v.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('v.status')
      .getRawMany();
    const byStatus: Record<string, number> = {};
    Object.values(VehicleStatus).forEach((s) => (byStatus[s] = 0));
    rows.forEach((r) => (byStatus[r.status] = +r.count));
    const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
    const availabilityPct = total ? Math.round((byStatus[VehicleStatus.DISPONIBLE] / total) * 1000) / 10 : 0;
    return { total, byStatus, availabilityPct };
  }

  private async assertPlateFree(plate: string, exceptId?: string) {
    const where = exceptId ? { plate, id: Not(exceptId) } : { plate };
    if (await this.repo.exists({ where })) throw new ConflictException('Ya existe un vehículo con esa patente');
  }

  /** Evita estados contradictorios: p. ej. marcar "disponible" un carro que está en el taller. */
  private async assertManualStatusAllowed(id: string, next: VehicleStatus) {
    const b = await this.status.blockers(id);
    if (b.activeMaintenance) {
      throw new ConflictException('El vehículo tiene una mantención en proceso; su estado cambiará al completarla o cancelarla');
    }
    if (b.openCriticalIncident && next !== VehicleStatus.FUERA_DE_SERVICIO) {
      throw new ConflictException('El vehículo tiene una incidencia crítica abierta; resuélvela antes de cambiar su estado');
    }
  }
}
