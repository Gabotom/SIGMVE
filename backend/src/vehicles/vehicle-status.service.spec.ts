import { VehicleStatusService } from './vehicle-status.service';
import { VehicleStatus as S } from './vehicle.entity';

const none = { activeMaintenance: false, openCriticalIncident: false };
const resolve = VehicleStatusService.resolve;

describe('VehicleStatusService.resolve (regla de disponibilidad)', () => {
  it('mantención en proceso -> en_mantencion (tiene prioridad sobre todo)', () => {
    expect(resolve(S.DISPONIBLE, { activeMaintenance: true, openCriticalIncident: true }, false)).toBe(S.EN_MANTENCION);
  });

  it('incidencia crítica abierta -> fuera_de_servicio', () => {
    expect(resolve(S.DISPONIBLE, { ...none, openCriticalIncident: true }, false)).toBe(S.FUERA_DE_SERVICIO);
  });

  it('sin bloqueos, en_mantencion vuelve a disponible', () => {
    expect(resolve(S.EN_MANTENCION, none, false)).toBe(S.DISPONIBLE);
  });

  it('termina la mantención pero sigue la incidencia crítica -> fuera_de_servicio, no disponible', () => {
    expect(resolve(S.EN_MANTENCION, { ...none, openCriticalIncident: true }, true)).toBe(S.FUERA_DE_SERVICIO);
  });

  it('fuera_de_servicio puesto a mano no se libera por un evento no relacionado', () => {
    expect(resolve(S.FUERA_DE_SERVICIO, none, false)).toBe(S.FUERA_DE_SERVICIO);
  });

  it('fuera_de_servicio se libera cuando el evento lo indica (mantención completada / crítica cerrada)', () => {
    expect(resolve(S.FUERA_DE_SERVICIO, none, true)).toBe(S.DISPONIBLE);
  });

  it('en_emergencia no se toca si no hay bloqueos', () => {
    expect(resolve(S.EN_EMERGENCIA, none, true)).toBe(S.EN_EMERGENCIA);
  });
});
