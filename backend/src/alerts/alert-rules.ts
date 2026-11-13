import { AlertSeverity, AlertStatus, AlertType, SEVERITY_RANK } from './alert.entity';
import { IncidentSeverity } from '../incidents/incident.entity';
import { daysBetween } from '../common/dates';

/**
 * Motor de reglas de alertas. Todo lo de este archivo son funciones puras (sin BD), para
 * poder probar cada regla con datos en memoria. AlertsService arma el snapshot y aplica el resultado.
 */

export interface AlertConfig {
  /** Días hacia adelante para avisar mantenciones próximas. */
  upcomingDays: number;
  /** Desde cuántos días de atraso una mantención vencida pasa a crítica. */
  overdueCriticalDays: number;
  /** Horas que puede estar abierta una incidencia no crítica antes de alertar. */
  staleIncidentHours: number;
  /** % mínimo de la flota disponible. */
  minAvailabilityPct: number;
}

export const DEFAULT_ALERT_CONFIG: AlertConfig = { upcomingDays: 7, overdueCriticalDays: 7, staleIncidentHours: 24, minAvailabilityPct: 70 };

interface VehicleRef { id: string; plate: string }

export interface AlertSnapshot {
  /** Fecha local 'YYYY-MM-DD'. */
  today: string;
  now: Date;
  /** Mantenciones en estado programada. */
  scheduledMaintenances: { id: string; description: string; scheduledDate: string; vehicle: VehicleRef }[];
  /** Incidencias en estado abierta (las en_atencion ya tienen mantención: no alertan). */
  openIncidents: { id: string; title: string; severity: IncidentSeverity; createdAt: Date; vehicle: VehicleRef }[];
  fleet: { total: number; available: number };
}

export interface AlertCandidate {
  type: AlertType;
  severity: AlertSeverity;
  sourceKey: string;
  vehicleId: string | null;
  title: string;
  detail: string;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function buildCandidates(s: AlertSnapshot, cfg: AlertConfig = DEFAULT_ALERT_CONFIG): AlertCandidate[] {
  const out: AlertCandidate[] = [];

  for (const m of s.scheduledMaintenances) {
    const daysLeft = daysBetween(s.today, m.scheduledDate);
    if (daysLeft < 0) {
      const late = -daysLeft;
      out.push({
        type: AlertType.MANTENCION_VENCIDA,
        severity: late >= cfg.overdueCriticalDays ? AlertSeverity.CRITICA : AlertSeverity.ADVERTENCIA,
        sourceKey: `maintenance:${m.id}`,
        vehicleId: m.vehicle.id,
        title: `${m.vehicle.plate}: mantención vencida hace ${plural(late, 'día', 'días')}`,
        detail: `"${m.description}" estaba programada para el ${m.scheduledDate} y no se ha iniciado.`,
      });
    } else if (daysLeft <= cfg.upcomingDays) {
      out.push({
        type: AlertType.MANTENCION_PROXIMA,
        severity: AlertSeverity.INFO,
        sourceKey: `maintenance:${m.id}`,
        vehicleId: m.vehicle.id,
        title: `${m.vehicle.plate}: mantención ${daysLeft === 0 ? 'programada para hoy' : `en ${plural(daysLeft, 'día', 'días')}`}`,
        detail: `"${m.description}" programada para el ${m.scheduledDate}.`,
      });
    }
  }

  for (const i of s.openIncidents) {
    if (i.severity === IncidentSeverity.CRITICA) {
      out.push({
        type: AlertType.INCIDENCIA_CRITICA,
        severity: AlertSeverity.CRITICA,
        sourceKey: `incident:${i.id}`,
        vehicleId: i.vehicle.id,
        title: `${i.vehicle.plate}: incidencia crítica sin mantención asignada`,
        detail: `"${i.title}". El vehículo está fuera de servicio hasta que se atienda.`,
      });
      continue;
    }
    const hours = Math.floor((s.now.getTime() - new Date(i.createdAt).getTime()) / 3_600_000);
    if (hours >= cfg.staleIncidentHours) {
      out.push({
        type: AlertType.INCIDENCIA_SIN_ATENDER,
        severity: i.severity === IncidentSeverity.ALTA ? AlertSeverity.ADVERTENCIA : AlertSeverity.INFO,
        sourceKey: `incident:${i.id}`,
        vehicleId: i.vehicle.id,
        title: `${i.vehicle.plate}: incidencia ${i.severity} sin atender hace ${hours < 48 ? plural(hours, 'hora', 'horas') : plural(Math.floor(hours / 24), 'día', 'días')}`,
        detail: `"${i.title}" sigue abierta y no tiene mantención asignada.`,
      });
    }
  }

  const { total, available } = s.fleet;
  if (total > 0) {
    const pct = Math.round((available / total) * 1000) / 10;
    if (pct < cfg.minAvailabilityPct) {
      out.push({
        type: AlertType.BAJA_DISPONIBILIDAD,
        severity: AlertSeverity.CRITICA,
        sourceKey: 'flota',
        vehicleId: null,
        title: `Disponibilidad de la flota en ${pct}% (mínimo ${cfg.minAvailabilityPct}%)`,
        detail: `${plural(available, 'vehículo disponible', 'vehículos disponibles')} de ${total}.`,
      });
    }
  }
  return out;
}

export interface LiveAlert {
  id: string;
  type: AlertType;
  sourceKey: string;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  detail: string;
}

export interface AlertDiff {
  toCreate: AlertCandidate[];
  toUpdate: { id: string; changes: Partial<Pick<LiveAlert, 'severity' | 'status' | 'title' | 'detail'>> }[];
  /** Alertas vivas cuya condición ya no se cumple. */
  toResolve: string[];
}

export const alertKey = (a: { type: AlertType; sourceKey: string }) => `${a.type}|${a.sourceKey}`;

/**
 * Compara lo que debería estar alertado con lo que ya hay en la BD:
 *  - condición nueva        -> se crea (activa)
 *  - condición que sigue    -> se actualiza el texto/severidad si cambió; si la severidad SUBE,
 *                              una alerta ya reconocida vuelve a activa (hay que volver a mirarla)
 *  - condición que terminó  -> se resuelve
 */
export function diffAlerts(candidates: AlertCandidate[], live: LiveAlert[]): AlertDiff {
  const liveByKey = new Map(live.map((a) => [alertKey(a), a]));
  const seen = new Set<string>();
  const diff: AlertDiff = { toCreate: [], toUpdate: [], toResolve: [] };

  for (const c of candidates) {
    const key = alertKey(c);
    if (seen.has(key)) continue;
    seen.add(key);
    const current = liveByKey.get(key);
    if (!current) {
      diff.toCreate.push(c);
      continue;
    }
    const changes: AlertDiff['toUpdate'][number]['changes'] = {};
    if (c.title !== current.title) changes.title = c.title;
    if (c.detail !== current.detail) changes.detail = c.detail;
    if (c.severity !== current.severity) {
      changes.severity = c.severity;
      if (SEVERITY_RANK[c.severity] > SEVERITY_RANK[current.severity] && current.status === AlertStatus.RECONOCIDA) {
        changes.status = AlertStatus.ACTIVA;
      }
    }
    if (Object.keys(changes).length) diff.toUpdate.push({ id: current.id, changes });
  }

  for (const a of live) if (!seen.has(alertKey(a))) diff.toResolve.push(a.id);
  return diff;
}
