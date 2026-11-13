import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { NotifyService } from '../../core/notify.service';
import { Incident, Vehicle } from '../../core/models';
import { INCIDENT_SEVERITIES, INCIDENT_STATUSES } from '../../core/labels';
import { ChipComponent } from '../../shared/chip.component';
import { LabelPipe } from '../../shared/label.pipe';
import { IncidentFormDialog } from './incident-form.dialog';
import { IncidentDetailDialog } from './incident-detail.dialog';

@Component({
  selector: 'app-incident-list',
  standalone: true,
  imports: [
    FormsModule, RouterLink, DatePipe, MatTableModule, MatFormFieldModule, MatSelectModule, MatButtonModule, MatIconModule,
    MatSlideToggleModule, MatProgressBarModule, ChipComponent, LabelPipe,
  ],
  templateUrl: './incident-list.component.html',
})
export class IncidentListComponent implements OnInit {
  private api = inject(ApiService);
  private dialog = inject(MatDialog);
  private notify = inject(NotifyService);
  auth = inject(AuthService);

  readonly severities = INCIDENT_SEVERITIES;
  readonly statuses = INCIDENT_STATUSES;
  readonly columns = ['createdAt', 'vehicle', 'title', 'severity', 'status', 'reportedBy'];

  incidents = signal<Incident[]>([]);
  vehicles = signal<Vehicle[]>([]);
  loading = signal(false);
  filters = { vehicleId: '', status: '', severity: '', open: true };

  ngOnInit() {
    this.api.vehicles().subscribe((v) => this.vehicles.set(v));
    this.load();
  }

  load() {
    this.loading.set(true);
    const { open, status, ...rest } = this.filters;
    // "Solo abiertas" incluye abierta y en_atencion; si se elige un estado puntual, manda ese.
    const query = { ...rest, ...(status ? { status } : open ? { open: 'true' } : {}) };
    this.api.incidents(query).subscribe({
      next: (i) => { this.incidents.set(i); this.loading.set(false); },
      error: (err) => { this.notify.error(err); this.loading.set(false); },
    });
  }

  create() {
    this.dialog.open(IncidentFormDialog, { data: {}, width: '600px' }).afterClosed().subscribe((i?: Incident) => {
      if (!i) return;
      this.notify.ok(i.severity === 'critica' ? `Incidencia crítica reportada: ${i.vehicle.plate} quedó fuera de servicio` : 'Incidencia reportada');
      this.load();
    });
  }

  open(row: Incident) {
    // Se pide de nuevo para traer la mantención asociada y quién la resolvió.
    this.api.incident(row.id).subscribe((i) =>
      this.dialog.open(IncidentDetailDialog, { data: i, width: '620px' }).afterClosed().subscribe((updated) => {
        if (updated) { this.notify.ok('Incidencia actualizada'); this.load(); }
      }),
    );
  }
}
