import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { NotifyService } from '../../core/notify.service';
import { Alert, Incident, Maintenance, Vehicle, VehicleStatus } from '../../core/models';
import { MANUAL_VEHICLE_STATUSES } from '../../core/labels';
import { ChipComponent } from '../../shared/chip.component';
import { LabelPipe } from '../../shared/label.pipe';
import { VehicleFormDialog } from './vehicle-form.dialog';
import { MaintenanceFormDialog } from '../maintenances/maintenance-form.dialog';
import { MaintenanceUpdateDialog } from '../maintenances/maintenance-update.dialog';
import { IncidentFormDialog } from '../incidents/incident-form.dialog';
import { IncidentDetailDialog } from '../incidents/incident-detail.dialog';

/** Ficha del vehículo: datos, cambio de estado y su historial de mantenciones, incidencias y alertas. */
@Component({
  selector: 'app-vehicle-detail',
  standalone: true,
  imports: [
    RouterLink, DatePipe, CurrencyPipe, DecimalPipe, MatButtonModule, MatIconModule, MatMenuModule, MatTabsModule,
    MatProgressBarModule, ChipComponent, LabelPipe,
  ],
  templateUrl: './vehicle-detail.component.html',
  styleUrl: './vehicle-detail.component.scss',
})
export class VehicleDetailComponent implements OnInit {
  /** :id de la ruta (withComponentInputBinding). */
  id = input.required<string>();

  private api = inject(ApiService);
  private dialog = inject(MatDialog);
  private notify = inject(NotifyService);
  auth = inject(AuthService);

  readonly manualStatuses = MANUAL_VEHICLE_STATUSES;
  vehicle = signal<Vehicle | null>(null);
  maintenances = signal<Maintenance[]>([]);
  incidents = signal<Incident[]>([]);
  alerts = signal<Alert[]>([]);
  loading = signal(true);
  openIncidents = computed(() => this.incidents().filter((i) => i.status === 'abierta' || i.status === 'en_atencion').length);

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    forkJoin({
      vehicle: this.api.vehicle(this.id()),
      incidents: this.api.incidents({ vehicleId: this.id() }),
      alerts: this.api.alerts({ vehicleId: this.id() }),
    }).subscribe({
      next: ({ vehicle, incidents, alerts }) => {
        this.vehicle.set(vehicle);
        this.maintenances.set(vehicle.maintenances ?? []);
        this.incidents.set(incidents);
        this.alerts.set(alerts);
        this.loading.set(false);
      },
      error: (err) => { this.notify.error(err); this.loading.set(false); },
    });
  }

  setStatus(status: VehicleStatus) {
    this.api.updateVehicle(this.id(), { status }).subscribe({
      next: () => { this.notify.ok(`Estado cambiado a "${status.replace(/_/g, ' ')}"`); this.load(); },
      error: (err) => this.notify.error(err),
    });
  }

  edit() {
    this.dialog.open(VehicleFormDialog, { data: this.vehicle(), width: '560px' }).afterClosed().subscribe((v) => {
      if (v) { this.notify.ok('Vehículo actualizado'); this.load(); }
    });
  }

  newMaintenance() {
    this.dialog.open(MaintenanceFormDialog, { data: { vehicle: this.vehicle() }, width: '600px' }).afterClosed().subscribe((m) => {
      if (m) { this.notify.ok('Mantención registrada'); this.load(); }
    });
  }

  editMaintenance(m: Maintenance) {
    if (!this.auth.canEdit()) return;
    this.dialog.open(MaintenanceUpdateDialog, { data: { ...m, vehicle: this.vehicle() }, width: '560px' }).afterClosed().subscribe((s) => {
      if (s) { this.notify.ok('Mantención actualizada'); this.load(); }
    });
  }

  newIncident() {
    this.dialog.open(IncidentFormDialog, { data: { vehicle: this.vehicle() }, width: '600px' }).afterClosed().subscribe((i) => {
      if (i) { this.notify.ok('Incidencia reportada'); this.load(); }
    });
  }

  openIncident(row: Incident) {
    this.api.incident(row.id).subscribe((i) =>
      this.dialog.open(IncidentDetailDialog, { data: i, width: '620px' }).afterClosed().subscribe((u) => {
        if (u) { this.notify.ok('Incidencia actualizada'); this.load(); }
      }),
    );
  }
}
