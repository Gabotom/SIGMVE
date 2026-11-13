import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { ApiService } from '../../core/api.service';
import { apiError } from '../../core/notify.service';
import { Vehicle } from '../../core/models';
import { MAINTENANCE_TYPES } from '../../core/labels';
import { LabelPipe } from '../../shared/label.pipe';
import { toIsoDate } from '../../shared/dates';

export interface MaintenanceFormData { vehicle?: Vehicle }

/** Al crear se puede registrar una mantención ya realizada (completada), pero no una cancelada. */
const CREATE_STATUSES = ['programada', 'en_proceso', 'completada'] as const;

/** Registro de una mantención nueva. Si viene un vehículo (desde su ficha), queda fijo. */
@Component({
  standalone: true,
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatDatepickerModule, LabelPipe],
  template: `
    <h2 mat-dialog-title>Nueva mantención{{ data.vehicle ? ' · ' + data.vehicle.plate : '' }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content>
        @if (error()) { <div class="dialog-error">{{ error() }}</div> }
        <div class="form-grid">
          @if (!data.vehicle) {
            <mat-form-field class="full">
              <mat-label>Vehículo</mat-label>
              <mat-select formControlName="vehicleId">
                @for (v of vehicles(); track v.id) { <mat-option [value]="v.id">{{ v.plate }} · {{ v.brand }} {{ v.model }}</mat-option> }
              </mat-select>
              <mat-error>Selecciona un vehículo</mat-error>
            </mat-form-field>
          }
          <mat-form-field>
            <mat-label>Tipo</mat-label>
            <mat-select formControlName="type">
              @for (t of types; track t) { <mat-option [value]="t">{{ t | label }}</mat-option> }
            </mat-select>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Estado inicial</mat-label>
            <mat-select formControlName="status">
              @for (s of statuses; track s) { <mat-option [value]="s">{{ s | label }}</mat-option> }
            </mat-select>
            @if (form.controls.status.value === 'en_proceso') { <mat-hint>El vehículo pasará a "En mantención"</mat-hint> }
          </mat-form-field>
          <mat-form-field class="full">
            <mat-label>Descripción</mat-label>
            <textarea matInput formControlName="description" rows="2" placeholder="Cambio de aceite y filtros"></textarea>
            <mat-error>Mínimo 3 caracteres</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Fecha programada</mat-label>
            <input matInput [matDatepicker]="dp" formControlName="scheduledDate" />
            <mat-datepicker-toggle matIconSuffix [for]="dp" />
            <mat-datepicker #dp />
          </mat-form-field>
          <mat-form-field>
            <mat-label>Costo (CLP)</mat-label>
            <input matInput type="number" formControlName="cost" min="0" />
          </mat-form-field>
          @if (form.controls.status.value === 'completada') {
            <mat-form-field>
              <mat-label>Fecha de término</mat-label>
              <input matInput [matDatepicker]="dc" formControlName="completedDate" [max]="maxDate" />
              <mat-datepicker-toggle matIconSuffix [for]="dc" />
              <mat-datepicker #dc />
              <mat-hint>Vacío = hoy</mat-hint>
            </mat-form-field>
          }
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button mat-flat-button color="primary" type="submit" [disabled]="saving()">Guardar</button>
      </mat-dialog-actions>
    </form>
  `,
})
export class MaintenanceFormDialog implements OnInit {
  private api = inject(ApiService);
  private ref = inject(MatDialogRef<MaintenanceFormDialog>);
  data: MaintenanceFormData = inject(MAT_DIALOG_DATA) ?? {};

  readonly types = MAINTENANCE_TYPES;
  readonly statuses = CREATE_STATUSES;
  readonly maxDate = new Date();
  vehicles = signal<Vehicle[]>([]);
  saving = signal(false);
  error = signal<string | null>(null);

  form = inject(FormBuilder).group({
    vehicleId: [this.data.vehicle?.id ?? '', Validators.required],
    type: ['preventiva', Validators.required],
    status: ['programada', Validators.required],
    description: ['', [Validators.required, Validators.minLength(3)]],
    scheduledDate: [new Date() as Date | null, Validators.required],
    cost: [0, Validators.min(0)],
    completedDate: [null as Date | null],
  });

  ngOnInit() {
    if (!this.data.vehicle) this.api.vehicles().subscribe((v) => this.vehicles.set(v));
  }

  save() {
    if (this.form.invalid) return this.form.markAllAsTouched();
    this.saving.set(true);
    const v = this.form.getRawValue();
    const body = {
      vehicleId: v.vehicleId,
      type: v.type,
      status: v.status,
      description: v.description,
      scheduledDate: toIsoDate(v.scheduledDate),
      cost: Number(v.cost ?? 0),
      ...(v.status === 'completada' && v.completedDate && { completedDate: toIsoDate(v.completedDate) }),
    };
    this.api.createMaintenance(body).subscribe({
      next: (m) => this.ref.close(m),
      error: (err) => {
        this.error.set(apiError(err));
        this.saving.set(false);
      },
    });
  }
}
