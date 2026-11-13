import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { ApiService } from '../../core/api.service';
import { apiError } from '../../core/notify.service';
import { ROLES } from '../../core/labels';
import { LabelPipe } from '../../shared/label.pipe';

/** Misma regla que el backend: 8+ caracteres con al menos una letra y un número. */
export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, LabelPipe],
  template: `
    <h2 mat-dialog-title>Nuevo usuario</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content>
        @if (error()) { <div class="dialog-error">{{ error() }}</div> }
        <div class="form-grid">
          <mat-form-field class="full">
            <mat-label>Nombre completo</mat-label>
            <input matInput formControlName="fullName" />
            <mat-error>Mínimo 3 caracteres</mat-error>
          </mat-form-field>
          <mat-form-field class="full">
            <mat-label>Correo</mat-label>
            <input matInput type="email" formControlName="email" />
            <mat-error>Correo inválido</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Contraseña inicial</mat-label>
            <input matInput type="text" formControlName="password" autocomplete="new-password" />
            <mat-hint>8+ caracteres, letras y números</mat-hint>
            <mat-error>8+ caracteres, letras y números</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Rol</mat-label>
            <mat-select formControlName="role">
              @for (r of roles; track r) { <mat-option [value]="r">{{ r | label }}</mat-option> }
            </mat-select>
          </mat-form-field>
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button mat-flat-button color="primary" type="submit" [disabled]="saving()">Crear</button>
      </mat-dialog-actions>
    </form>
  `,
})
export class UserFormDialog {
  private api = inject(ApiService);
  private ref = inject(MatDialogRef<UserFormDialog>);
  readonly roles = ROLES;
  saving = signal(false);
  error = signal<string | null>(null);

  form = inject(FormBuilder).nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.pattern(PASSWORD_PATTERN)]],
    role: ['operator', Validators.required],
  });

  save() {
    if (this.form.invalid) return this.form.markAllAsTouched();
    this.saving.set(true);
    this.api.createUser(this.form.getRawValue()).subscribe({
      next: (u) => this.ref.close(u),
      error: (err) => {
        this.error.set(apiError(err));
        this.saving.set(false);
      },
    });
  }
}
