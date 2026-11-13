import { ConflictException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { IncidentsService } from './incidents.service';
import { IncidentSeverity as Sev, IncidentStatus as St } from './incident.entity';
import { ChangeIncidentStatusDto } from './incident.dto';
import { MaintenanceType } from '../maintenances/maintenance.entity';
import { Role } from '../common/roles';

describe('IncidentsService', () => {
  const repo: any = { findOne: jest.fn(), save: jest.fn(async (v) => ({ id: 'i1', ...v })), create: jest.fn((v) => v), remove: jest.fn() };
  const vehicles: any = { findOne: jest.fn(), update: jest.fn() };
  const vehicleStatus: any = { recompute: jest.fn() };
  const maintenances: any = { create: jest.fn(async (d) => ({ id: 'm1', ...d })) };
  const service = new IncidentsService(repo, vehicles, vehicleStatus, maintenances);
  const actor = { userId: 'u1', email: 'op@sigmve.cl', fullName: 'Operador', role: Role.OPERATOR };
  beforeEach(() => jest.clearAllMocks());

  const vehicle = { id: 'v1', mileage: 1000 };
  const incident = (extra = {}) => ({ id: 'i1', vehicle, title: 'Falla bomba', severity: Sev.MEDIA, status: St.ABIERTA, maintenance: null, ...extra });
  const base = { vehicleId: 'v1', title: 'Falla bomba', description: 'No alcanza presión' };

  describe('create', () => {
    beforeEach(() => {
      vehicles.findOne.mockResolvedValue(vehicle);
      repo.findOne.mockResolvedValue(incident());
    });

    it('registra quién reporta y queda abierta', async () => {
      await service.create({ ...base, severity: Sev.MEDIA }, actor);
      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ reportedBy: { id: 'u1' }, status: St.ABIERTA }));
    });

    it('una incidencia crítica recalcula el estado del vehículo (queda fuera de servicio)', async () => {
      await service.create({ ...base, severity: Sev.CRITICA }, actor);
      expect(vehicleStatus.recompute).toHaveBeenCalledWith('v1');
    });

    it('una incidencia no crítica no altera el estado del vehículo', async () => {
      await service.create({ ...base, severity: Sev.BAJA }, actor);
      expect(vehicleStatus.recompute).not.toHaveBeenCalled();
    });

    it('actualiza el kilometraje del vehículo solo si es mayor', async () => {
      await service.create({ ...base, severity: Sev.BAJA, mileage: 1500 }, actor);
      expect(vehicles.update).toHaveBeenCalledWith('v1', { mileage: 1500 });
      vehicles.update.mockClear();
      await service.create({ ...base, severity: Sev.BAJA, mileage: 900 }, actor);
      expect(vehicles.update).not.toHaveBeenCalled();
    });

    it('lanza NotFound si el vehículo no existe', async () => {
      vehicles.findOne.mockResolvedValue(null);
      await expect(service.create({ ...base, severity: Sev.BAJA }, actor)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('changeStatus', () => {
    it('resolver registra resolución, fecha y responsable', async () => {
      repo.findOne.mockResolvedValue(incident());
      await service.changeStatus('i1', { status: St.RESUELTA, resolution: 'Se cambió el sello' }, actor);
      const saved = repo.save.mock.calls[0][0];
      expect(saved).toMatchObject({ status: St.RESUELTA, resolution: 'Se cambió el sello', resolvedBy: { id: 'u1' } });
      expect(saved.resolvedAt).toBeInstanceOf(Date);
    });

    it('cerrar una incidencia crítica libera el vehículo', async () => {
      repo.findOne.mockResolvedValue(incident({ severity: Sev.CRITICA }));
      await service.changeStatus('i1', { status: St.DESCARTADA, resolution: 'Falsa alarma' }, actor);
      expect(vehicleStatus.recompute).toHaveBeenCalledWith('v1', { releaseOutOfService: true });
    });

    it.each([[St.RESUELTA], [St.DESCARTADA]])('una incidencia %s no se puede reabrir', async (from) => {
      repo.findOne.mockResolvedValue(incident({ status: from }));
      await expect(service.changeStatus('i1', { status: St.ABIERTA }, actor)).rejects.toBeInstanceOf(ConflictException);
    });

    it('el DTO exige resolución al resolver', async () => {
      const errs = await validate(plainToInstance(ChangeIncidentStatusDto, { status: 'resuelta' }));
      expect(errs.map((e) => e.property)).toContain('resolution');
      const ok = await validate(plainToInstance(ChangeIncidentStatusDto, { status: 'en_atencion' }));
      expect(ok).toHaveLength(0);
    });
  });

  describe('update', () => {
    it('bajar la severidad desde crítica permite liberar el vehículo', async () => {
      repo.findOne.mockResolvedValue(incident({ severity: Sev.CRITICA }));
      await service.update('i1', { severity: Sev.MEDIA });
      expect(vehicleStatus.recompute).toHaveBeenCalledWith('v1', { releaseOutOfService: true });
    });

    it('no permite editar una incidencia cerrada', async () => {
      repo.findOne.mockResolvedValue(incident({ status: St.RESUELTA }));
      await expect(service.update('i1', { title: 'Nuevo título' })).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('createMaintenance', () => {
    it('crea una mantención correctiva y deja la incidencia en atención', async () => {
      repo.findOne.mockResolvedValue(incident());
      await service.createMaintenance('i1', { scheduledDate: '2026-10-20' });
      expect(maintenances.create).toHaveBeenCalledWith(
        expect.objectContaining({ vehicleId: 'v1', type: MaintenanceType.CORRECTIVA, description: 'Incidencia: Falla bomba' }),
      );
      expect(repo.save.mock.calls[0][0]).toMatchObject({ status: St.EN_ATENCION, maintenance: { id: 'm1' } });
    });

    it('no crea una segunda mantención si ya hay una en curso', async () => {
      repo.findOne.mockResolvedValue(incident({ status: St.EN_ATENCION, maintenance: { id: 'm0' } }));
      await expect(service.createMaintenance('i1', { scheduledDate: '2026-10-20' })).rejects.toBeInstanceOf(ConflictException);
      expect(maintenances.create).not.toHaveBeenCalled();
    });
  });
});
