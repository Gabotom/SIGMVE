import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { VehicleStatus, VehicleType } from './vehicle.entity';

describe('VehiclesService', () => {
  const repo: any = { findOne: jest.fn(), exists: jest.fn(), save: jest.fn(async (v) => v), create: jest.fn((v) => v), remove: jest.fn() };
  const maintenances: any = { count: jest.fn() };
  const incidents: any = { count: jest.fn() };
  const status: any = { blockers: jest.fn() };
  const service = new VehiclesService(repo, maintenances, incidents, status);
  beforeEach(() => {
    jest.clearAllMocks();
    status.blockers.mockResolvedValue({ activeMaintenance: false, openCriticalIncident: false });
  });

  const dto = { plate: ' abcd-12 ', type: VehicleType.BOMBA, brand: 'Mercedes', model: 'Atego', year: 2018 };
  const vehicle = (extra = {}) => ({ id: 'v1', plate: 'ABCD-12', mileage: 1000, status: VehicleStatus.DISPONIBLE, ...extra });

  it('crea un vehículo normalizando la patente a mayúsculas', async () => {
    repo.exists.mockResolvedValue(false);
    const result = await service.create(dto);
    expect(result.plate).toBe('ABCD-12');
  });

  it('rechaza una patente duplicada al crear', async () => {
    repo.exists.mockResolvedValue(true);
    await expect(service.create(dto)).rejects.toBeInstanceOf(ConflictException);
  });

  it('lanza NotFound si el vehículo no existe', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.findOne('x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rechaza cambiar a una patente que ya usa otro vehículo (antes daba 500)', async () => {
    repo.findOne.mockResolvedValue(vehicle());
    repo.exists.mockResolvedValue(true);
    await expect(service.update('v1', { plate: 'bbbb-22' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('no permite que el kilometraje disminuya', async () => {
    repo.findOne.mockResolvedValue(vehicle());
    await expect(service.update('v1', { mileage: 500 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('no permite marcar disponible un vehículo con mantención en proceso', async () => {
    repo.findOne.mockResolvedValue(vehicle({ status: VehicleStatus.EN_MANTENCION }));
    status.blockers.mockResolvedValue({ activeMaintenance: true, openCriticalIncident: false });
    await expect(service.update('v1', { status: VehicleStatus.DISPONIBLE })).rejects.toBeInstanceOf(ConflictException);
  });

  it('no permite marcar disponible un vehículo con incidencia crítica abierta', async () => {
    repo.findOne.mockResolvedValue(vehicle({ status: VehicleStatus.FUERA_DE_SERVICIO }));
    status.blockers.mockResolvedValue({ activeMaintenance: false, openCriticalIncident: true });
    await expect(service.update('v1', { status: VehicleStatus.DISPONIBLE })).rejects.toBeInstanceOf(ConflictException);
  });

  it('permite cambiar a en_emergencia un vehículo sin bloqueos', async () => {
    repo.findOne.mockResolvedValue(vehicle());
    const res = await service.update('v1', { status: VehicleStatus.EN_EMERGENCIA });
    expect(res.status).toBe(VehicleStatus.EN_EMERGENCIA);
  });

  it('no elimina un vehículo con historial', async () => {
    repo.findOne.mockResolvedValue(vehicle());
    maintenances.count.mockResolvedValue(2);
    incidents.count.mockResolvedValue(0);
    await expect(service.remove('v1')).rejects.toBeInstanceOf(ConflictException);
    expect(repo.remove).not.toHaveBeenCalled();
  });

  it('elimina un vehículo sin historial', async () => {
    repo.findOne.mockResolvedValue(vehicle());
    maintenances.count.mockResolvedValue(0);
    incidents.count.mockResolvedValue(0);
    await expect(service.remove('v1')).resolves.toEqual({ deleted: true });
  });
});
