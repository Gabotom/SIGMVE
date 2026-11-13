import { Component, OnInit, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { NotifyService } from '../../core/notify.service';
import { Vehicle } from '../../core/models';
import { VEHICLE_STATUSES, VEHICLE_TYPES } from '../../core/labels';
import { ChipComponent } from '../../shared/chip.component';
import { LabelPipe } from '../../shared/label.pipe';
import { ConfirmDialog } from '../../shared/confirm.dialog';
import { VehicleFormDialog } from './vehicle-form.dialog';

@Component({
  selector: 'app-vehicle-list',
  standalone: true,
  imports: [
    FormsModule, RouterLink, DecimalPipe, MatTableModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatTooltipModule, MatProgressBarModule, ChipComponent, LabelPipe,
  ],
  templateUrl: './vehicle-list.component.html',
})
export class VehicleListComponent implements OnInit {
  private api = inject(ApiService);
  private dialog = inject(MatDialog);
  private notify = inject(NotifyService);
  private router = inject(Router);
  auth = inject(AuthService);

  readonly types = VEHICLE_TYPES;
  readonly statuses = VEHICLE_STATUSES;
  readonly columns = ['plate', 'type', 'model', 'station', 'mileage', 'status', 'actions'];

  vehicles = signal<Vehicle[]>([]);
  loading = signal(false);
  filters = { search: '', status: '', type: '', station: '' };
  private search$ = new Subject<void>();

  constructor() {
    // El dashboard enlaza aquí con ?status=disponible, etc.
    const status = inject(ActivatedRoute).snapshot.queryParamMap.get('status');
    if (status) this.filters.status = status;
    this.search$.pipe(debounceTime(300)).subscribe(() => this.load());
  }

  ngOnInit() { this.load(); }

  onSearch() { this.search$.next(); }

  load() {
    this.loading.set(true);
    this.api.vehicles(this.filters).subscribe({
      next: (v) => { this.vehicles.set(v); this.loading.set(false); },
      error: (err) => { this.notify.error(err); this.loading.set(false); },
    });
  }

  clear() {
    this.filters = { search: '', status: '', type: '', station: '' };
    this.load();
  }

  open(v: Vehicle) { this.router.navigate(['/vehiculos', v.id]); }

  edit(v: Vehicle | null, event?: Event) {
    event?.stopPropagation();
    this.dialog.open(VehicleFormDialog, { data: v, width: '560px' }).afterClosed().subscribe((saved?: Vehicle) => {
      if (!saved) return;
      this.notify.ok(v ? 'Vehículo actualizado' : `Vehículo ${saved.plate} registrado`);
      this.load();
    });
  }

  remove(v: Vehicle, event: Event) {
    event.stopPropagation();
    this.dialog
      .open(ConfirmDialog, { data: { title: 'Eliminar vehículo', message: `¿Eliminar ${v.plate}? Solo se puede si no tiene mantenciones ni incidencias.`, confirm: 'Eliminar' } })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.api.deleteVehicle(v.id).subscribe({
          next: () => { this.notify.ok('Vehículo eliminado'); this.load(); },
          error: (err) => this.notify.error(err),
        });
      });
  }
}
