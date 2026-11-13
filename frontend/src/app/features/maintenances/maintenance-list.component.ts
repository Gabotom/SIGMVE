import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { NotifyService } from '../../core/notify.service';
import { Maintenance, Vehicle } from '../../core/models';
import { MAINTENANCE_STATUSES, MAINTENANCE_TYPES } from '../../core/labels';
import { ChipComponent } from '../../shared/chip.component';
import { LabelPipe } from '../../shared/label.pipe';
import { ConfirmDialog } from '../../shared/confirm.dialog';
import { today } from '../../shared/dates';
import { MaintenanceFormDialog } from './maintenance-form.dialog';
import { MaintenanceUpdateDialog } from './maintenance-update.dialog';

@Component({
  selector: 'app-maintenance-list',
  standalone: true,
  imports: [
    FormsModule, RouterLink, DatePipe, CurrencyPipe, MatTableModule, MatFormFieldModule, MatSelectModule, MatButtonModule,
    MatIconModule, MatTooltipModule, MatProgressBarModule, ChipComponent, LabelPipe,
  ],
  templateUrl: './maintenance-list.component.html',
})
export class MaintenanceListComponent implements OnInit {
  private api = inject(ApiService);
  private dialog = inject(MatDialog);
  private notify = inject(NotifyService);
  auth = inject(AuthService);

  readonly types = MAINTENANCE_TYPES;
  readonly statuses = MAINTENANCE_STATUSES;
  readonly columns = ['scheduledDate', 'vehicle', 'type', 'description', 'cost', 'status', 'actions'];
  readonly today = today();

  maintenances = signal<Maintenance[]>([]);
  vehicles = signal<Vehicle[]>([]);
  loading = signal(false);
  filters = { vehicleId: '', status: '', type: '' };

  /** Total de lo mostrado, sin contar las canceladas (igual que el reporte de costos). */
  total = computed(() => this.maintenances().filter((m) => m.status !== 'cancelada').reduce((s, m) => s + m.cost, 0));

  ngOnInit() {
    this.api.vehicles().subscribe((v) => this.vehicles.set(v));
    this.load();
  }

  load() {
    this.loading.set(true);
    this.api.maintenances(this.filters).subscribe({
      next: (m) => { this.maintenances.set(m); this.loading.set(false); },
      error: (err) => { this.notify.error(err); this.loading.set(false); },
    });
  }

  isOverdue(m: Maintenance) { return m.status === 'programada' && m.scheduledDate < this.today; }

  create() {
    this.dialog.open(MaintenanceFormDialog, { data: {}, width: '600px' }).afterClosed().subscribe((m) => {
      if (m) { this.notify.ok('Mantención registrada'); this.load(); }
    });
  }

  update(m: Maintenance) {
    if (!this.auth.canEdit()) return;
    this.dialog.open(MaintenanceUpdateDialog, { data: m, width: '560px' }).afterClosed().subscribe((saved) => {
      if (saved) { this.notify.ok('Mantención actualizada'); this.load(); }
    });
  }

  remove(m: Maintenance, event: Event) {
    event.stopPropagation();
    this.dialog
      .open(ConfirmDialog, { data: { title: 'Eliminar mantención', message: `¿Eliminar "${m.description}" de ${m.vehicle?.plate}?`, confirm: 'Eliminar' } })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.api.deleteMaintenance(m.id).subscribe({
          next: () => { this.notify.ok('Mantención eliminada'); this.load(); },
          error: (err) => this.notify.error(err),
        });
      });
  }
}
