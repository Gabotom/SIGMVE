import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { ApiService } from '../../core/api.service';
import { apiError } from '../../core/notify.service';
import { Vehicle } from '../../core/models';
import { INCIDENT_SEVERITIES } from '../../core/labels';
import { LabelPipe } from '../../shared/label.pipe';

export interface IncidentFormData { vehicle?: Vehicle }

/** Reporte de una falla. Si es crítica, el backend deja el vehículo fuera de servicio. */
@Component({
  standalone: true,
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, LabelPipe],
  template: `
    <h2 mat-dialog-title>Reportar incidencia{{ data.vehicle ? ' · ' + data.vehicle.plate : '' }}</h2>
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
          <mat-form-field class="full">
            <mat-label>Título</mat-label>
            <input matInput formControlName="title" placeholder="Falla en bomba de agua" maxlength="150" />
            <mat-error>Entre 5 y 150 caracteres</mat-error>
          </mat-form-field>
          <mat-form-field class="full">
            <mat-label>Descripción</mat-label>
            <textarea matInput formControlName="description" rows="3" placeholder="Qué pasó, cuándo y en qué condiciones"></textarea>
            <mat-error>Mínimo 10 caracteres</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Severidad</mat-label>
            <mat-select formControlName="severity">
              @for (s of severities; track s) { <mat-option [value]="s">{{ s | label }}</mat-option> }
            </mat-select>
            @if (form.controls.severity.value === 'critica') { <mat-hint class="bad-hint">El vehículo quedará fuera de servicio</mat-hint> }
          </mat-form-field>
          <mat-form-field>
            <mat-label>Kilometraje actual (opcional)</mat-label>
            <input matInput type="number" formControlName="mileage" min="0" />
          </mat-form-field>
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button mat-flat-button color="primary" type="submit" [disabled]="saving()">Reportar</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: ['.bad-hint { color: var(--bad); }'],
})
export class IncidentFormDialog implements OnInit {
  private api = inject(ApiService);
  private ref = inject(MatDialogRef<IncidentFormDialog>);
  data: IncidentFormData = inject(MAT_DIALOG_DATA) ?? {};

  readonly severities = INCIDENT_SEVERITIES;
  vehicles = signal<Vehicle[]>([]);
  saving = signal(false);
  error = signal<string | null>(null);

  form = inject(FormBuilder).group({
    vehicleId: [this.data.vehicle?.id ?? '', Validators.required],
    title: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(150)]],
    description: ['', [Validators.required, Validators.minLength(10)]],
    severity: ['media', Validators.required],
    mileage: [null as number | null, Validators.min(0)],
  });

  ngOnInit() {
    if (!this.data.vehicle) this.api.vehicles().subscribe((v) => this.vehicles.set(v));
  }

  save() {
    if (this.form.invalid) return this.form.markAllAsTouched();
    this.saving.set(true);
    const { mileage, ...v } = this.form.getRawValue();
    const body = { ...v, ...(mileage !== null && mileage !== undefined && String(mileage) !== '' && { mileage: Number(mileage) }) };
    this.api.createIncident(body).subscribe({
      next: (i) => this.ref.close(i),
      error: (err) => {
        this.error.set(apiError(err));
        this.saving.set(false);
      },
    });
  }
}
