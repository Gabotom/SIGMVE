import { ConflictException } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AlertSeverity as Sev, AlertStatus as St, AlertType as T } from './alert.entity';
import { IncidentSeverity } from '../incidents/incident.entity';
import { Role } from '../common/roles';
import { addDays, localDate } from '../common/dates';

describe('AlertsService', () => {
  const repo: any = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(async (v) => v),
    create: jest.fn((v) => v),
    update: jest.fn(),
  };
  const maintenances: any = { find: jest.fn() };
  const incidents: any = { find: jest.fn() };
  const vehicles: any = { count: jest.fn() };
  const config: any = { get: (_k: string) => undefined };
  let service: AlertsService;
  const vehicle = { id: 'v1', plate: 'ABCD-12' };
  const actor = { userId: 'u1', email: 'op@sigmve.cl', fullName: 'Operador', role: Role.OPERATOR };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AlertsService(repo, maintenances, incidents, vehicles, config);
    maintenances.find.mockResolvedValue([]);
    incidents.find.mockResolvedValue([]);
    vehicles.count.mockResolvedValue(0);
    repo.find.mockResolvedValue([]);
  });

  it('evaluate crea las alertas nuevas y resuelve las que ya no aplican', async () => {
    maintenances.find.mockResolvedValue([{ id: 'm1', description: 'Aceite', scheduledDate: addDays(localDate(), -2), vehicle }]);
    incidents.find.mockResolvedValue([{ id: 'i1', title: 'Bomba', severity: IncidentSeverity.CRITICA, createdAt: new Date(), vehicle }]);
    repo.find.mockResolvedValueOnce([
      { id: 'old', type: T.INCIDENCIA_CRITICA, sourceKey: 'incident:cerrada', severity: Sev.CRITICA, status: St.ACTIVA, title: 'x', detail: 'y' },
    ]);

    const r = await service.evaluate();

    expect(r).toMatchObject({ created: 2, updated: 0, resolved: 1, live: 2 });
    const saved = repo.save.mock.calls[0][0];
    expect(saved.map((a: any) => a.type)).toEqual([T.MANTENCION_VENCIDA, T.INCIDENCIA_CRITICA]);
    expect(saved[0].vehicle).toEqual({ id: 'v1' });
    expect(repo.update).toHaveBeenCalledWith({ id: expect.anything() }, expect.objectContaining({ status: St.RESUELTA }));
  });

  it('dos evaluaciones simultáneas comparten una sola pasada (no duplican alertas)', async () => {
    await Promise.all([service.evaluate(), service.evaluate()]);
    expect(maintenances.find).toHaveBeenCalledTimes(1);
  });

  it('findAll solo vuelve a evaluar si algo cambió (markStale)', async () => {
    await service.findAll();
    await service.findAll();
    expect(maintenances.find).toHaveBeenCalledTimes(1);
    service.markStale();
    await service.findAll();
    expect(maintenances.find).toHaveBeenCalledTimes(2);
  });

  it('si la evaluación falla, la próxima consulta reintenta', async () => {
    maintenances.find.mockRejectedValueOnce(new Error('bd caída'));
    await expect(service.findAll()).rejects.toThrow('bd caída');
    await service.findAll();
    expect(maintenances.find).toHaveBeenCalledTimes(2);
  });

  describe('acknowledge', () => {
    it('registra quién y cuándo la reconoce', async () => {
      repo.findOne.mockResolvedValue({ id: 'a1', status: St.ACTIVA });
      await service.acknowledge('a1', { note: 'Lo veo yo' }, actor);
      expect(repo.update).toHaveBeenCalledWith('a1', expect.objectContaining({
        status: St.RECONOCIDA, acknowledgedBy: { id: 'u1' }, acknowledgeNote: 'Lo veo yo', acknowledgedAt: expect.any(Date),
      }));
    });

    it('no se reconoce dos veces ni una resuelta', async () => {
      repo.findOne.mockResolvedValue({ id: 'a1', status: St.RECONOCIDA });
      await expect(service.acknowledge('a1', {}, actor)).rejects.toBeInstanceOf(ConflictException);
      repo.findOne.mockResolvedValue({ id: 'a1', status: St.RESUELTA });
      await expect(service.acknowledge('a1', {}, actor)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  it('usa los umbrales de .env', async () => {
    const custom = new AlertsService(repo, maintenances, incidents, vehicles, { get: (k: string) => (k === 'ALERT_MIN_AVAILABILITY_PCT' ? '50' : undefined) } as any);
    vehicles.count.mockResolvedValueOnce(10).mockResolvedValueOnce(6); // total, disponibles = 60%
    expect((await custom.evaluate()).created).toBe(0);
  });
});
