import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { ApiService } from '../../core/api.service';
import { apiError } from '../../core/notify.service';
import { Vehicle } from '../../core/models';
import { VEHICLE_TYPES } from '../../core/labels';
import { LabelPipe } from '../../shared/label.pipe';

/** Mismo formato que valida el backend: ABCD-12 / ABCD12 (nuevo) o AB-1234 / AB1234 (antiguo). */
const PLATE_PATTERN = /^([A-Za-z]{4}-?\d{2}|[A-Za-z]{2}-?\d{4})$/;
const MAX_YEAR = new Date().getFullYear() + 1;

/** Alta y edición de vehículos. Recibe el vehículo a editar o null para crear uno nuevo. */
@Component({
  standalone: true,
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, LabelPipe],
  template: `
    <h2 mat-dialog-title>{{ vehicle ? 'Editar ' + vehicle.plate : 'Nuevo vehículo' }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content>
        @if (error()) { <div class="dialog-error">{{ error() }}</div> }
        <div class="form-grid">
          <mat-form-field>
            <mat-label>Patente</mat-label>
            <input matInput formControlName="plate" placeholder="ABCD-12" class="mono" />
            @if (form.controls.plate.hasError('pattern')) { <mat-error>Formato ABCD-12 o AB-1234</mat-error> }
          </mat-form-field>
          <mat-form-field>
            <mat-label>Tipo</mat-label>
            <mat-select formControlName="type">
              @for (t of types; track t) { <mat-option [value]="t">{{ t | label }}</mat-option> }
            </mat-select>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Marca</mat-label>
            <input matInput formControlName="brand" />
          </mat-form-field>
          <mat-form-field>
            <mat-label>Modelo</mat-label>
            <input matInput formControlName="model" />
          </mat-form-field>
          <mat-form-field>
            <mat-label>Año</mat-label>
            <input matInput type="number" formControlName="year" />
            @if (form.controls.year.invalid) { <mat-error>Entre 1980 y {{ maxYear }}</mat-error> }
          </mat-form-field>
          <mat-form-field>
            <mat-label>Kilometraje</mat-label>
            <input matInput type="number" formControlName="mileage" />
            @if (vehicle) { <mat-hint>No puede ser menor a {{ vehicle.mileage }}</mat-hint> }
          </mat-form-field>
          <mat-form-field class="full">
            <mat-label>Compañía / unidad</mat-label>
            <input matInput formControlName="station" placeholder="Primera Compañía" />
          </mat-form-field>
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button mat-flat-button color="primary" type="submit" [disabled]="saving()">Guardar</button>
      </mat-dialog-actions>
    </form>
  `,
})
export class VehicleFormDialog {
  private api = inject(ApiService);
  private ref = inject(MatDialogRef<VehicleFormDialog>);
  vehicle: Vehicle | null = inject(MAT_DIALOG_DATA);

  readonly types = VEHICLE_TYPES;
  readonly maxYear = MAX_YEAR;
  saving = signal(false);
  error = signal<string | null>(null);

  form = inject(FormBuilder).nonNullable.group({
    plate: [this.vehicle?.plate ?? '', [Validators.required, Validators.pattern(PLATE_PATTERN)]],
    type: [this.vehicle?.type ?? 'bomba', Validators.required],
    brand: [this.vehicle?.brand ?? '', Validators.required],
    model: [this.vehicle?.model ?? '', Validators.required],
    year: [this.vehicle?.year ?? new Date().getFullYear(), [Validators.required, Validators.min(1980), Validators.max(MAX_YEAR)]],
    mileage: [this.vehicle?.mileage ?? 0, [Validators.min(0)]],
    station: [this.vehicle?.station ?? ''],
  });

  save() {
    if (this.form.invalid) return this.form.markAllAsTouched();
    this.saving.set(true);
    const v = this.form.getRawValue();
    const body = { ...v, station: v.station.trim() || undefined, year: Number(v.year), mileage: Number(v.mileage) };
    const req = this.vehicle ? this.api.updateVehicle(this.vehicle.id, body) : this.api.createVehicle(body);
    req.subscribe({
      next: (saved) => this.ref.close(saved),
      error: (err) => {
        this.error.set(apiError(err));
        this.saving.set(false);
      },
    });
  }
}
