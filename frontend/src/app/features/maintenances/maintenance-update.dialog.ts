import { Component, inject, signal } from '@angular/core';
import { LowerCasePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { ApiService } from '../../core/api.service';
import { apiError } from '../../core/notify.service';
import { Maintenance } from '../../core/models';
import { MAINTENANCE_TRANSITIONS } from '../../core/labels';
import { LabelPipe } from '../../shared/label.pipe';
import { toIsoDate } from '../../shared/dates';

/**
 * Cambio de estado y corrección de datos de una mantención.
 * Solo ofrece las transiciones permitidas; si está cerrada (completada/cancelada) solo deja corregir costo y descripción.
 */
@Component({
  standalone: true,
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatDatepickerModule, LabelPipe, LowerCasePipe],
  template: `
    <h2 mat-dialog-title>Mantención · {{ m.vehicle?.plate }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content>
        @if (error()) { <div class="dialog-error">{{ error() }}</div> }
        @if (closed) {
          <p class="muted small">La mantención está {{ m.status | label | lowercase }}: solo se puede corregir el costo y la descripción.</p>
        }
        <div class="form-grid">
          <mat-form-field class="full">
            <mat-label>Estado</mat-label>
            <mat-select formControlName="status">
              @for (s of statusOptions; track s) { <mat-option [value]="s">{{ s | label }}</mat-option> }
            </mat-select>
            @if (form.controls.status.value === 'completada' && m.status !== 'completada') {
              <mat-hint>Al completarla, el vehículo vuelve a estar disponible y se resuelven sus incidencias asociadas</mat-hint>
            }
          </mat-form-field>
          <mat-form-field class="full">
            <mat-label>Descripción</mat-label>
            <textarea matInput formControlName="description" rows="2"></textarea>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Costo (CLP)</mat-label>
            <input matInput type="number" formControlName="cost" min="0" />
          </mat-form-field>
          @if (form.controls.status.value === 'completada' && !closed) {
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
export class MaintenanceUpdateDialog {
  private api = inject(ApiService);
  private ref = inject(MatDialogRef<MaintenanceUpdateDialog>);
  m: Maintenance = inject(MAT_DIALOG_DATA);

  readonly closed = this.m.status === 'completada' || this.m.status === 'cancelada';
  readonly statusOptions = [this.m.status, ...MAINTENANCE_TRANSITIONS[this.m.status]];
  readonly maxDate = new Date();
  saving = signal(false);
  error = signal<string | null>(null);

  form = inject(FormBuilder).nonNullable.group({
    status: [{ value: this.m.status as string, disabled: this.closed }],
    description: [this.m.description, [Validators.required, Validators.minLength(3)]],
    cost: [this.m.cost, Validators.min(0)],
    completedDate: [null as Date | null],
  });

  save() {
    if (this.form.invalid) return this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    // Se envía solo lo que cambió (en una cerrada, el backend rechaza cualquier otro campo).
    const body: Record<string, unknown> = {};
    if (v.description !== this.m.description) body['description'] = v.description;
    if (Number(v.cost) !== this.m.cost) body['cost'] = Number(v.cost);
    if (!this.closed && v.status !== this.m.status) {
      body['status'] = v.status;
      if (v.status === 'completada' && v.completedDate) body['completedDate'] = toIsoDate(v.completedDate);
    }
    if (Object.keys(body).length === 0) return this.ref.close();

    this.saving.set(true);
    this.api.updateMaintenance(this.m.id, body).subscribe({
      next: (saved) => this.ref.close(saved),
      error: (err) => {
        this.error.set(apiError(err));
        this.saving.set(false);
      },
    });
  }
}
