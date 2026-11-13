import { AlertCandidate, AlertSnapshot, buildCandidates, DEFAULT_ALERT_CONFIG, diffAlerts, LiveAlert } from './alert-rules';
import { AlertSeverity as Sev, AlertStatus as St, AlertType as T } from './alert.entity';
import { IncidentSeverity } from '../incidents/incident.entity';

const vehicle = { id: 'v1', plate: 'ABCD-12' };
const now = new Date('2026-10-16T15:00:00Z');
const snap = (extra: Partial<AlertSnapshot> = {}): AlertSnapshot => ({
  today: '2026-10-16',
  now,
  scheduledMaintenances: [],
  openIncidents: [],
  fleet: { total: 10, available: 10 },
  ...extra,
});
const maint = (id: string, scheduledDate: string) => ({ id, description: 'Cambio de aceite', scheduledDate, vehicle });
const incident = (id: string, severity: IncidentSeverity, hoursAgo: number) => ({
  id, title: 'Falla', severity, vehicle, createdAt: new Date(now.getTime() - hoursAgo * 3_600_000),
});
const types = (c: AlertCandidate[]) => c.map((a) => a.type);

describe('buildCandidates (reglas de alertas)', () => {
  it('sin problemas no hay alertas', () => {
    expect(buildCandidates(snap())).toEqual([]);
  });

  it('mantención programada con fecha pasada -> vencida (advertencia)', () => {
    const [a] = buildCandidates(snap({ scheduledMaintenances: [maint('m1', '2026-10-14')] }));
    expect(a).toMatchObject({ type: T.MANTENCION_VENCIDA, severity: Sev.ADVERTENCIA, sourceKey: 'maintenance:m1', vehicleId: 'v1' });
    expect(a.title).toBe('ABCD-12: mantención vencida hace 2 días');
  });

  it(`vencida hace ${DEFAULT_ALERT_CONFIG.overdueCriticalDays}+ días escala a crítica`, () => {
    const [a] = buildCandidates(snap({ scheduledMaintenances: [maint('m1', '2026-10-09')] }));
    expect(a.severity).toBe(Sev.CRITICA);
  });

  it('mantención de hoy o dentro de la ventana -> próxima (info); fuera de la ventana no alerta', () => {
    const c = buildCandidates(snap({ scheduledMaintenances: [maint('hoy', '2026-10-16'), maint('pronto', '2026-10-23'), maint('lejos', '2026-10-24')] }));
    expect(c.map((a) => a.sourceKey)).toEqual(['maintenance:hoy', 'maintenance:pronto']);
    expect(c[0].title).toContain('programada para hoy');
    expect(c[1].title).toContain('en 7 días');
    expect(c.every((a) => a.type === T.MANTENCION_PROXIMA && a.severity === Sev.INFO)).toBe(true);
  });

  it('incidencia crítica abierta alerta de inmediato', () => {
    const [a] = buildCandidates(snap({ openIncidents: [incident('i1', IncidentSeverity.CRITICA, 0)] }));
    expect(a).toMatchObject({ type: T.INCIDENCIA_CRITICA, severity: Sev.CRITICA, sourceKey: 'incident:i1' });
  });

  it('incidencia no crítica solo alerta tras el plazo sin atender; alta = advertencia, el resto = info', () => {
    const c = buildCandidates(snap({
      openIncidents: [incident('nueva', IncidentSeverity.ALTA, 2), incident('alta', IncidentSeverity.ALTA, 30), incident('baja', IncidentSeverity.BAJA, 72)],
    }));
    expect(c.map((a) => [a.sourceKey, a.severity])).toEqual([['incident:alta', Sev.ADVERTENCIA], ['incident:baja', Sev.INFO]]);
    expect(c[0].title).toContain('30 horas');
    expect(c[1].title).toContain('3 días');
  });

  it('disponibilidad de la flota bajo el mínimo -> alerta crítica de flota', () => {
    const [a] = buildCandidates(snap({ fleet: { total: 10, available: 6 } }));
    expect(a).toMatchObject({ type: T.BAJA_DISPONIBILIDAD, severity: Sev.CRITICA, sourceKey: 'flota', vehicleId: null });
    expect(a.title).toBe('Disponibilidad de la flota en 60% (mínimo 70%)');
    expect(buildCandidates(snap({ fleet: { total: 10, available: 7 } }))).toEqual([]);
    expect(buildCandidates(snap({ fleet: { total: 0, available: 0 } }))).toEqual([]);
  });

  it('los umbrales se pueden configurar', () => {
    const cfg = { ...DEFAULT_ALERT_CONFIG, upcomingDays: 1, minAvailabilityPct: 50 };
    expect(types(buildCandidates(snap({ scheduledMaintenances: [maint('m', '2026-10-20')], fleet: { total: 10, available: 6 } }), cfg))).toEqual([]);
  });
});

describe('diffAlerts (sincronización con la BD)', () => {
  const cand = (extra: Partial<AlertCandidate> = {}): AlertCandidate => ({
    type: T.MANTENCION_VENCIDA, severity: Sev.ADVERTENCIA, sourceKey: 'maintenance:m1', vehicleId: 'v1', title: 't', detail: 'd', ...extra,
  });
  const live = (extra: Partial<LiveAlert> = {}): LiveAlert => ({
    id: 'a1', type: T.MANTENCION_VENCIDA, severity: Sev.ADVERTENCIA, status: St.ACTIVA, sourceKey: 'maintenance:m1', title: 't', detail: 'd', ...extra,
  });

  it('condición nueva -> se crea', () => {
    expect(diffAlerts([cand()], [])).toEqual({ toCreate: [cand()], toUpdate: [], toResolve: [] });
  });

  it('condición que sigue igual -> no se toca (no se duplica)', () => {
    expect(diffAlerts([cand()], [live()])).toEqual({ toCreate: [], toUpdate: [], toResolve: [] });
  });

  it('condición que desapareció -> se resuelve', () => {
    expect(diffAlerts([], [live()]).toResolve).toEqual(['a1']);
  });

  it('cambia el texto (p. ej. más días de atraso) -> se actualiza', () => {
    expect(diffAlerts([cand({ title: 't2' })], [live()]).toUpdate).toEqual([{ id: 'a1', changes: { title: 't2' } }]);
  });

  it('si la severidad sube, una alerta reconocida vuelve a activa', () => {
    const { toUpdate } = diffAlerts([cand({ severity: Sev.CRITICA })], [live({ status: St.RECONOCIDA })]);
    expect(toUpdate).toEqual([{ id: 'a1', changes: { severity: Sev.CRITICA, status: St.ACTIVA } }]);
  });

  it('si la severidad baja, sigue reconocida', () => {
    const { toUpdate } = diffAlerts([cand()], [live({ severity: Sev.CRITICA, status: St.RECONOCIDA })]);
    expect(toUpdate).toEqual([{ id: 'a1', changes: { severity: Sev.ADVERTENCIA } }]);
  });

  it('próxima -> vencida para la misma mantención: se resuelve una y se crea la otra', () => {
    const d = diffAlerts([cand()], [live({ id: 'p1', type: T.MANTENCION_PROXIMA, severity: Sev.INFO })]);
    expect(d.toCreate).toHaveLength(1);
    expect(d.toResolve).toEqual(['p1']);
  });
});
