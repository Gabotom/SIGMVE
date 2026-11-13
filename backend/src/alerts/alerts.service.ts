import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Alert, AlertSeverity, AlertStatus, AlertType, LIVE_ALERT_STATUSES } from './alert.entity';
import { AlertConfig, buildCandidates, DEFAULT_ALERT_CONFIG, diffAlerts } from './alert-rules';
import { AcknowledgeAlertDto, AlertQueryDto } from './alert.dto';
import { Maintenance, MaintenanceStatus } from '../maintenances/maintenance.entity';
import { Incident, IncidentStatus } from '../incidents/incident.entity';
import { Vehicle, VehicleStatus } from '../vehicles/vehicle.entity';
import { AuthUser } from '../common/current-user.decorator';
import { localDate } from '../common/dates';

const SAFE_USER = { id: true, fullName: true, email: true } as const;
const VEHICLE_REF = { id: true, plate: true, type: true, station: true, status: true } as const;

export interface EvaluationResult { created: number; updated: number; resolved: number; live: number; evaluatedAt: Date }

/**
 * Módulo 5: alertas.
 *
 * Cuándo se evalúan las reglas:
 *  1. Al arrancar la API y cada ALERTS_CRON (AlertsScheduler), para las reglas que dependen del
 *     tiempo (una mantención se vence a medianoche aunque nadie toque nada).
 *  2. Al consultar alertas, si cambió algún vehículo, mantención o incidencia desde la última
 *     evaluación (AlertsInvalidationSubscriber marca "stale"). Así el listado nunca queda desfasado.
 *  3. A mano con POST /alerts/evaluate (admin).
 *
 * Nota: el flag "stale" y el candado viven en memoria; con varias instancias de la API, cada una
 * evalúa por su cuenta y el índice único parcial evita duplicados.
 */
@Injectable()
export class AlertsService {
  private readonly config: AlertConfig;
  private stale = true;
  private running: Promise<EvaluationResult> | null = null;
  private lastResult: EvaluationResult | null = null;

  constructor(
    @InjectRepository(Alert) private repo: Repository<Alert>,
    @InjectRepository(Maintenance) private maintenances: Repository<Maintenance>,
    @InjectRepository(Incident) private incidents: Repository<Incident>,
    @InjectRepository(Vehicle) private vehicles: Repository<Vehicle>,
    configService: ConfigService,
  ) {
    const num = (key: string, fallback: number) => {
      const raw = configService.get(key);
      return raw === undefined || raw === '' ? fallback : Number(raw); // ya validado en env.validation.ts
    };
    this.config = {
      upcomingDays: num('ALERT_UPCOMING_DAYS', DEFAULT_ALERT_CONFIG.upcomingDays),
      overdueCriticalDays: num('ALERT_OVERDUE_CRITICAL_DAYS', DEFAULT_ALERT_CONFIG.overdueCriticalDays),
      staleIncidentHours: num('ALERT_INCIDENT_STALE_HOURS', DEFAULT_ALERT_CONFIG.staleIncidentHours),
      minAvailabilityPct: num('ALERT_MIN_AVAILABILITY_PCT', DEFAULT_ALERT_CONFIG.minAvailabilityPct),
    };
  }

  /** Lo llama el subscriber cuando cambian datos que alimentan las reglas. */
  markStale() { this.stale = true; }

  /** Evalúa las reglas. Si ya hay una evaluación en curso, espera esa en vez de correr dos a la vez. */
  evaluate(): Promise<EvaluationResult> {
    if (!this.running) {
      this.running = this.doEvaluate().finally(() => (this.running = null));
    }
    return this.running;
  }

  private async ensureFresh() {
    if (this.running) await this.running;
    if (this.stale) await this.evaluate();
  }

  private async doEvaluate(): Promise<EvaluationResult> {
    // Se baja antes de leer: si algo cambia durante la evaluación, la próxima consulta vuelve a evaluar.
    this.stale = false;
    try {
      const now = new Date();
      const [scheduled, open, total, available, live] = await Promise.all([
        this.maintenances.find({ where: { status: MaintenanceStatus.PROGRAMADA }, relations: { vehicle: true } }),
        this.incidents.find({ where: { status: IncidentStatus.ABIERTA }, relations: { vehicle: true } }),
        this.vehicles.count(),
        this.vehicles.count({ where: { status: VehicleStatus.DISPONIBLE } }),
        this.repo.find({ where: { status: In(LIVE_ALERT_STATUSES) } }),
      ]);

      const candidates = buildCandidates(
        { today: localDate(now), now, scheduledMaintenances: scheduled, openIncidents: open, fleet: { total, available } },
        this.config,
      );
      const diff = diffAlerts(candidates, live);

      if (diff.toCreate.length) {
        await this.repo.save(
          diff.toCreate.map(({ vehicleId, ...c }) => this.repo.create({ ...c, vehicle: vehicleId ? ({ id: vehicleId } as Vehicle) : null })),
        );
      }
      for (const u of diff.toUpdate) await this.repo.update(u.id, u.changes);
      if (diff.toResolve.length) {
        await this.repo.update({ id: In(diff.toResolve) }, { status: AlertStatus.RESUELTA, resolvedAt: now });
      }

      this.lastResult = {
        created: diff.toCreate.length,
        updated: diff.toUpdate.length,
        resolved: diff.toResolve.length,
        live: live.length + diff.toCreate.length - diff.toResolve.length,
        evaluatedAt: now,
      };
      return this.lastResult;
    } catch (e) {
      this.stale = true; // se reintenta en la próxima consulta
      throw e;
    }
  }

  async findAll(q: AlertQueryDto = {}) {
    await this.ensureFresh();
    const status = q.status ?? (q.all === 'true' ? undefined : In(LIVE_ALERT_STATUSES));
    return this.repo.find({
      where: {
        ...(status && { status }),
        ...(q.type && { type: q.type }),
        ...(q.severity && { severity: q.severity }),
        ...(q.vehicleId && { vehicle: { id: q.vehicleId } }),
      },
      relations: { vehicle: true, acknowledgedBy: true },
      select: { vehicle: VEHICLE_REF, acknowledgedBy: SAFE_USER },
      order: { severity: 'DESC', createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    await this.ensureFresh();
    const a = await this.repo.findOne({
      where: { id },
      relations: { vehicle: true, acknowledgedBy: true },
      select: { vehicle: VEHICLE_REF, acknowledgedBy: SAFE_USER },
    });
    if (!a) throw new NotFoundException('Alerta no encontrada');
    return a;
  }

  /** "Reconocer" = alguien ya la vio y se hace cargo. Sigue viva hasta que la condición desaparezca. */
  async acknowledge(id: string, dto: AcknowledgeAlertDto, actor: AuthUser) {
    const a = await this.findOne(id);
    if (a.status === AlertStatus.RESUELTA) throw new ConflictException('La alerta ya está resuelta');
    if (a.status === AlertStatus.RECONOCIDA) throw new ConflictException('La alerta ya fue reconocida');
    await this.repo.update(id, {
      status: AlertStatus.RECONOCIDA,
      acknowledgedAt: new Date(),
      acknowledgedBy: { id: actor.userId } as any,
      acknowledgeNote: dto.note ?? null,
    });
    return this.findOne(id);
  }

  /** Para el dashboard y el contador de la campana: alertas vivas por severidad y tipo. */
  async summary() {
    await this.ensureFresh();
    const rows: { severity: AlertSeverity; type: AlertType; status: AlertStatus; count: string }[] = await this.repo
      .createQueryBuilder('a')
      .select('a.severity', 'severity')
      .addSelect('a.type', 'type')
      .addSelect('a.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('a.status IN (:...live)', { live: LIVE_ALERT_STATUSES })
      .groupBy('a.severity')
      .addGroupBy('a.type')
      .addGroupBy('a.status')
      .getRawMany();

    const bySeverity = Object.fromEntries(Object.values(AlertSeverity).map((s) => [s, 0])) as Record<AlertSeverity, number>;
    const byType = Object.fromEntries(Object.values(AlertType).map((t) => [t, 0])) as Record<AlertType, number>;
    let total = 0;
    let unacknowledged = 0;
    for (const r of rows) {
      const n = +r.count; // COUNT llega como texto desde PostgreSQL
      total += n;
      bySeverity[r.severity] += n;
      byType[r.type] += n;
      if (r.status === AlertStatus.ACTIVA) unacknowledged += n;
    }
    return { total, unacknowledged, bySeverity, byType, lastEvaluatedAt: this.lastResult?.evaluatedAt ?? null, config: this.config };
  }
}
