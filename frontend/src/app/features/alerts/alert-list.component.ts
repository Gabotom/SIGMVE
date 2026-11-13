import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { NotifyService } from '../../core/notify.service';
import { Alert, AlertSummary } from '../../core/models';
import { ALERT_SEVERITIES, ALERT_TYPES } from '../../core/labels';
import { ChipComponent } from '../../shared/chip.component';
import { LabelPipe } from '../../shared/label.pipe';
import { AcknowledgeDialog } from './acknowledge.dialog';

const ICONS: Record<string, string> = {
  mantencion_vencida: 'event_busy',
  mantencion_proxima: 'event',
  incidencia_critica: 'car_crash',
  incidencia_sin_atender: 'hourglass_bottom',
  baja_disponibilidad: 'trending_down',
};

@Component({
  selector: 'app-alert-list',
  standalone: true,
  imports: [
    FormsModule, RouterLink, DatePipe, MatFormFieldModule, MatSelectModule, MatButtonModule, MatIconModule,
    MatButtonToggleModule, MatTooltipModule, MatProgressBarModule, ChipComponent, LabelPipe,
  ],
  templateUrl: './alert-list.component.html',
  styleUrl: './alert-list.component.scss',
})
export class AlertListComponent implements OnInit {
  private api = inject(ApiService);
  private dialog = inject(MatDialog);
  private notify = inject(NotifyService);
  auth = inject(AuthService);

  readonly types = ALERT_TYPES;
  readonly severities = ALERT_SEVERITIES;
  readonly icons = ICONS;

  alerts = signal<Alert[]>([]);
  summary = signal<AlertSummary | null>(null);
  loading = signal(false);
  /** vivas = activa + reconocida (lo que hay que mirar); historial = todas, incluidas las resueltas. */
  view: 'vivas' | 'activa' | 'historial' = 'vivas';
  filters = { type: '', severity: '' };

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    const query = {
      ...this.filters,
      ...(this.view === 'activa' && { status: 'activa' }),
      ...(this.view === 'historial' && { all: 'true' }),
    };
    this.api.alerts(query).subscribe({
      next: (a) => { this.alerts.set(a); this.loading.set(false); },
      error: (err) => { this.notify.error(err); this.loading.set(false); },
    });
    this.api.alertSummary().subscribe((s) => this.summary.set(s));
  }

  acknowledge(a: Alert) {
    this.dialog.open(AcknowledgeDialog, { data: a, width: '480px' }).afterClosed().subscribe((res?: { note: string }) => {
      if (!res) return;
      this.api.acknowledgeAlert(a.id, res.note || undefined).subscribe({
        next: () => { this.notify.ok('Alerta reconocida'); this.load(); },
        error: (err) => this.notify.error(err),
      });
    });
  }

  evaluate() {
    this.api.evaluateAlerts().subscribe({
      next: () => { this.notify.ok('Reglas evaluadas'); this.load(); },
      error: (err) => this.notify.error(err),
    });
  }
}
