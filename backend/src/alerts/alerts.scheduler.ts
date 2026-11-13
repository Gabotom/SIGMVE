import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { AlertsService } from './alerts.service';

const JOB = 'alerts-evaluation';

/**
 * Evaluación periódica de alertas. La expresión viene de ALERTS_CRON (por defecto cada 10 minutos)
 * y se interpreta en APP_TIMEZONE. ALERTS_CRON=off la desactiva (útil en pruebas).
 */
@Injectable()
export class AlertsScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(AlertsScheduler.name);

  constructor(private alerts: AlertsService, private registry: SchedulerRegistry, private config: ConfigService) {}

  async onApplicationBootstrap() {
    const expr = this.config.get<string>('ALERTS_CRON', '*/10 * * * *');
    if (expr !== 'off') {
      const job = CronJob.from({
        cronTime: expr,
        timeZone: this.config.get<string>('APP_TIMEZONE', 'America/Santiago'),
        onTick: () => this.run('programada'),
      });
      this.registry.addCronJob(JOB, job);
      job.start();
      this.logger.log(`Evaluación de alertas programada: "${expr}"`);
    }
    await this.run('inicial');
  }

  onApplicationShutdown() {
    if (this.registry.doesExist('cron', JOB)) this.registry.deleteCronJob(JOB);
  }

  private async run(origin: string) {
    try {
      const r = await this.alerts.evaluate();
      if (r.created || r.resolved) this.logger.log(`Evaluación ${origin}: ${r.created} nuevas, ${r.resolved} resueltas, ${r.live} vivas`);
    } catch (e) {
      this.logger.error(`Falló la evaluación ${origin} de alertas`, (e as Error).stack);
    }
  }
}
