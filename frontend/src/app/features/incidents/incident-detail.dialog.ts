import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatIconModule } from '@angular/material/icon';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { apiError } from '../../core/notify.service';
import { Incident } from '../../core/models';
import { INCIDENT_TRANSITIONS } from '../../core/labels';
import { ChipComponent } from '../../shared/chip.component';
import { LabelPipe } from '../../shared/label.pipe';
import { toIsoDate } from '../../shared/dates';

type Action = 'status' | 'maintenance';

/**
 * Ficha de una incidencia con sus dos acciones:
 *  - cambiar estado (resolver o descartar exige resolución)
 *  - generar una mantención correctiva (la incidencia queda en atención y se resuelve sola al completarla)
 */
@Component({
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule,
    MatButtonToggleModule, MatDatepickerModule, MatIconModule, ChipComponent, LabelPipe,
  ],
  template: `
    <h2 mat-dialog-title>{{ i.title }}</h2>
    <mat-dialog-content>
      <div class="meta">
        <app-chip [value]="i.severity" /> <app-chip [value]="i.status" />
        <span class="muted small">{{ i.vehicle.plate }} · reportada por {{ i.reportedBy?.fullName ?? '—' }} el {{ i.createdAt | date: 'dd-MM-yyyy HH:mm' }}</span>
      </div>
      <p>{{ i.description }}</p>
      @if (i.mileage) { <p class="muted small">Kilometraje al reportar: {{ i.mileage }} km</p> }
      @if (i.maintenance) {
        <p class="small"><mat-icon inline>build</mat-icon> Mantención asociada: {{ i.maintenance.description }} ({{ i.maintenance.status | label }})</p>
      }
      @if (i.resolution) {
        <div class="resolution">
          <strong>Resolución</strong> <span class="muted small">· {{ i.resolvedBy?.fullName }} el {{ i.resolvedAt | date: 'dd-MM-yyyy HH:mm' }}</span>
          <p>{{ i.resolution }}</p>
        </div>
      }

      @if (canAct) {
        <mat-button-toggle-group [value]="action()" (change)="action.set($event.value)" class="actions">
          <mat-button-toggle value="status">Cambiar estado</mat-button-toggle>
          <mat-button-toggle value="maintenance" [disabled]="hasActiveMaintenance">Generar mantención</mat-button-toggle>
        </mat-button-toggle-group>
        @if (error()) { <div class="dialog-error">{{ error() }}</div> }

        @if (action() === 'status') {
          <form [formGroup]="statusForm" class="form-grid">
            <mat-form-field class="full">
              <mat-label>Nuevo estado</mat-label>
              <mat-select formControlName="status">
                @for (s of transitions; track s) { <mat-option [value]="s">{{ s | label }}</mat-option> }
              </mat-select>
            </mat-form-field>
            @if (needsResolution()) {
              <mat-form-field class="full">
                <mat-label>Resolución</mat-label>
                <textarea matInput formControlName="resolution" rows="2" placeholder="Qué se hizo o por qué se descarta"></textarea>
                <mat-error>Mínimo 5 caracteres</mat-error>
              </mat-form-field>
            }
          </form>
        } @else {
          <form [formGroup]="maintForm" class="form-grid">
            <mat-form-field>
              <mat-label>Fecha programada</mat-label>
              <input matInput [matDatepicker]="dp" formControlName="scheduledDate" />
              <mat-datepicker-toggle matIconSuffix [for]="dp" />
              <mat-datepicker #dp />
            </mat-form-field>
            <mat-form-field>
              <mat-label>Descripción (opcional)</mat-label>
              <input matInput formControlName="description" [placeholder]="'Incidencia: ' + i.title" />
            </mat-form-field>
            <p class="full muted small">Se crea una mantención correctiva. Al completarla, esta incidencia queda resuelta automáticamente.</p>
          </form>
        }
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>{{ canAct ? 'Cancelar' : 'Cerrar' }}</button>
      @if (canAct) {
        <button mat-flat-button color="primary" (click)="submit()" [disabled]="saving()">
          {{ action() === 'status' ? 'Guardar estado' : 'Crear mantención' }}
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: [`
    .meta { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 8px; }
    .resolution { background: var(--ok-bg); border-radius: 8px; padding: 8px 12px; margin: 8px 0; p { margin: 4px 0 0; } }
    .actions { margin: 12px 0 16px; }
  `],
})
export class IncidentDetailDialog {
  private api = inject(ApiService);
  private ref = inject(MatDialogRef<IncidentDetailDialog>);
  i: Incident = inject(MAT_DIALOG_DATA);

  readonly transitions = INCIDENT_TRANSITIONS[this.i.status];
  readonly canAct = inject(AuthService).canEdit() && this.transitions.length > 0;
  readonly hasActiveMaintenance = this.i.status === 'en_atencion' && !!this.i.maintenance;

  action = signal<Action>('status');
  saving = signal(false);
  error = signal<string | null>(null);

  private fb = inject(FormBuilder);
  statusForm = this.fb.nonNullable.group({ status: [this.transitions[0] ?? '', Validators.required], resolution: [''] });
  maintForm = this.fb.group({ scheduledDate: [new Date() as Date | null, Validators.required], description: [''] });

  needsResolution() {
    const s = this.statusForm.controls.status.value;
    return s === 'resuelta' || s === 'descartada';
  }

  submit() {
    this.error.set(null);
    if (this.action() === 'status') {
      const { status, resolution } = this.statusForm.getRawValue();
      if (this.needsResolution() && resolution.trim().length < 5) {
        this.statusForm.controls.resolution.setErrors({ minlength: true });
        return this.statusForm.markAllAsTouched();
      }
      this.run(this.api.changeIncidentStatus(this.i.id, { status, ...(this.needsResolution() && { resolution }) }));
    } else {
      if (this.maintForm.invalid) return this.maintForm.markAllAsTouched();
      const { scheduledDate, description } = this.maintForm.getRawValue();
      this.run(this.api.maintenanceFromIncident(this.i.id, {
        scheduledDate: toIsoDate(scheduledDate),
        ...(description?.trim() && { description: description.trim() }),
      }));
    }
  }

  private run(req: ReturnType<ApiService['changeIncidentStatus']>) {
    this.saving.set(true);
    req.subscribe({
      next: (updated) => this.ref.close(updated),
      error: (err) => {
        this.error.set(apiError(err));
        this.saving.set(false);
      },
    });
  }
}
