import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ApiService } from '../../core/api.service';
import { NotifyService } from '../../core/notify.service';
import { Alert, AlertSummary, IncidentSummary, Maintenance, VehicleCost, VehicleStatus, VehicleSummary } from '../../core/models';
import { VEHICLE_STATUSES } from '../../core/labels';
import { ChipComponent } from '../../shared/chip.component';
import { LabelPipe } from '../../shared/label.pipe';

/** Color de cada estado en el gráfico de la flota (mismos tonos que las etiquetas). */
const STATUS_COLORS: Record<VehicleStatus, string> = {
  disponible: '#2e9e55',
  en_emergencia: '#3b78d8',
  en_mantencion: '#e0a100',
  fuera_de_servicio: '#d64535',
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, DatePipe, CurrencyPipe, DecimalPipe, MatIconModule, MatButtonModule, MatProgressBarModule, ChipComponent, LabelPipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private api = inject(ApiService);
  private notify = inject(NotifyService);

  loading = signal(true);
  vehicles = signal<VehicleSummary | null>(null);
  incidents = signal<IncidentSummary | null>(null);
  alertSummary = signal<AlertSummary | null>(null);
  topAlerts = signal<Alert[]>([]);
  upcoming = signal<Maintenance[]>([]);
  costs = signal<VehicleCost[]>([]);

  readonly statuses = VEHICLE_STATUSES;
  readonly colors = STATUS_COLORS;

  /** Gráfico de dona con conic-gradient: cada estado ocupa su % del círculo. */
  donut = computed(() => {
    const s = this.vehicles();
    if (!s?.total) return 'conic-gradient(var(--line) 0 100%)';
    let acc = 0;
    const parts = VEHICLE_STATUSES.map((st) => {
      const from = acc;
      acc += (s.byStatus[st] / s.total) * 100;
      return `${STATUS_COLORS[st]} ${from}% ${acc}%`;
    });
    return `conic-gradient(${parts.join(', ')})`;
  });

  maxCost = computed(() => Math.max(1, ...this.costs().map((c) => c.totalCost)));

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    forkJoin({
      vehicles: this.api.vehicleSummary(),
      incidents: this.api.incidentSummary(),
      alertSummary: this.api.alertSummary(),
      alerts: this.api.alerts(),
      maintenances: this.api.maintenances({ status: 'programada' }),
      costs: this.api.costs(),
    }).subscribe({
      next: (r) => {
        this.vehicles.set(r.vehicles);
        this.incidents.set(r.incidents);
        this.alertSummary.set(r.alertSummary);
        this.topAlerts.set(r.alerts.slice(0, 5)); // la API ya las ordena por severidad
        this.upcoming.set([...r.maintenances].sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)).slice(0, 5));
        this.costs.set(r.costs.slice(0, 5));
        this.loading.set(false);
      },
      error: (err) => {
        this.notify.error(err);
        this.loading.set(false);
      },
    });
  }
}
