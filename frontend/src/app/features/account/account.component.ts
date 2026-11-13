import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { NotifyService, apiError } from '../../core/notify.service';
import { LabelPipe } from '../../shared/label.pipe';
import { PASSWORD_PATTERN } from '../users/user-form.dialog';

const samePassword = (g: AbstractControl): ValidationErrors | null =>
  g.get('newPassword')?.value === g.get('confirm')?.value ? null : { mismatch: true };

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, LabelPipe],
  template: `
    <div class="page-header"><div><h1>Mi cuenta</h1><p>{{ auth.user()?.fullName }} · {{ auth.user()?.email }} · {{ auth.role() | label }}</p></div></div>
    <form class="card" [formGroup]="form" (ngSubmit)="save()" style="max-width: 420px">
      <h2>Cambiar contraseña</h2>
      @if (error()) { <div class="dialog-error">{{ error() }}</div> }
      <mat-form-field style="width: 100%">
        <mat-label>Contraseña actual</mat-label>
        <input matInput type="password" formControlName="currentPassword" autocomplete="current-password" />
      </mat-form-field>
      <mat-form-field style="width: 100%">
        <mat-label>Nueva contraseña</mat-label>
        <input matInput type="password" formControlName="newPassword" autocomplete="new-password" />
        <mat-hint>8+ caracteres, letras y números</mat-hint>
        <mat-error>8+ caracteres, letras y números</mat-error>
      </mat-form-field>
      <mat-form-field style="width: 100%">
        <mat-label>Repite la nueva contraseña</mat-label>
        <input matInput type="password" formControlName="confirm" autocomplete="new-password" />
      </mat-form-field>
      @if (form.hasError('mismatch') && form.controls.confirm.touched) { <div class="dialog-error">Las contraseñas no coinciden</div> }
      <button mat-flat-button color="primary" type="submit" [disabled]="saving()">Cambiar contraseña</button>
    </form>
  `,
})
export class AccountComponent {
  private api = inject(ApiService);
  private notify = inject(NotifyService);
  auth = inject(AuthService);
  saving = signal(false);
  error = signal<string | null>(null);

  form = inject(FormBuilder).nonNullable.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.pattern(PASSWORD_PATTERN)]],
      confirm: ['', Validators.required],
    },
    { validators: samePassword },
  );

  save() {
    if (this.form.invalid) return this.form.markAllAsTouched();
    this.saving.set(true);
    this.error.set(null);
    const { currentPassword, newPassword } = this.form.getRawValue();
    this.api.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.notify.ok('Contraseña actualizada');
        this.form.reset();
        this.saving.set(false);
      },
      error: (err) => {
        this.error.set(apiError(err));
        this.saving.set(false);
      },
    });
  }
}
