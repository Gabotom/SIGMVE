import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { MaintenancesService } from './maintenances.service';
import { MaintenanceStatus as M, MaintenanceType } from './maintenance.entity';
import { IncidentStatus } from '../incidents/incident.entity';

describe('MaintenancesService', () => {
  const repo: any = { findOne: jest.fn(), save: jest.fn(async (v) => ({ id: 'm1', ...v })), create: jest.fn((v) => v), remove: jest.fn() };
  const vehicles: any = { findOne: jest.fn() };
  const incidents: any = { update: jest.fn() };
  const vehicleStatus: any = { recompute: jest.fn() };
  const service = new MaintenancesService(repo, vehicles, incidents, vehicleStatus);
  beforeEach(() => jest.clearAllMocks());

  const vehicle = { id: 'v1' };
  const maint = (status: M, extra = {}) => ({ id: 'm1', vehicle, status, scheduledDate: '2026-10-01', completedDate: null, ...extra });

  it('crea y recalcula el estado del vehículo', async () => {
    vehicles.findOne.mockResolvedValue(vehicle);
    await service.create({ vehicleId: 'v1', type: MaintenanceType.PREVENTIVA, description: 'Cambio aceite', scheduledDate: '2026-10-20', status: M.EN_PROCESO });
    expect(vehicleStatus.recompute).toHaveBeenCalledWith('v1', { releaseOutOfService: false });
  });

  it('lanza NotFound si el vehículo no existe', async () => {
    vehicles.findOne.mockResolvedValue(null);
    await expect(service.create({ vehicleId: 'x', type: MaintenanceType.PREVENTIVA, description: 'abc', scheduledDate: '2026-10-20' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each([
    [M.COMPLETADA, M.PROGRAMADA],
    [M.COMPLETADA, M.EN_PROCESO],
    [M.CANCELADA, M.EN_PROCESO],
    [M.EN_PROCESO, M.PROGRAMADA],
  ])('rechaza la transición %s -> %s', async (from, to) => {
    repo.findOne.mockResolvedValue(maint(from));
    await expect(service.update('m1', { status: to })).rejects.toBeInstanceOf(ConflictException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('en una mantención cerrada solo permite corregir costo y descripción', async () => {
    repo.findOne.mockResolvedValue(maint(M.COMPLETADA, { completedDate: '2026-10-02' }));
    await expect(service.update('m1', { cost: 120000 })).resolves.toBeDefined();
    repo.findOne.mockResolvedValue(maint(M.COMPLETADA, { completedDate: '2026-10-02' }));
    await expect(service.update('m1', { scheduledDate: '2026-11-01' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('al completar: fija la fecha, resuelve incidencias asociadas y libera el vehículo', async () => {
    repo.findOne.mockResolvedValue(maint(M.EN_PROCESO));
    const res = await service.update('m1', { status: M.COMPLETADA });
    expect(res.completedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(incidents.update).toHaveBeenCalledWith(
      { maintenance: { id: 'm1' }, status: IncidentStatus.EN_ATENCION },
      expect.objectContaining({ status: IncidentStatus.RESUELTA }),
    );
    expect(vehicleStatus.recompute).toHaveBeenCalledWith('v1', { releaseOutOfService: true });
  });

  it('al cancelar: las incidencias asociadas vuelven a abierta', async () => {
    repo.findOne.mockResolvedValue(maint(M.PROGRAMADA));
    await service.update('m1', { status: M.CANCELADA });
    expect(incidents.update).toHaveBeenCalledWith(
      { maintenance: { id: 'm1' }, status: IncidentStatus.EN_ATENCION },
      { status: IncidentStatus.ABIERTA },
    );
    expect(vehicleStatus.recompute).toHaveBeenCalledWith('v1', { releaseOutOfService: false });
  });

  it('rechaza una fecha de término futura', async () => {
    repo.findOne.mockResolvedValue(maint(M.EN_PROCESO));
    await expect(service.update('m1', { status: M.COMPLETADA, completedDate: '2999-01-01' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
