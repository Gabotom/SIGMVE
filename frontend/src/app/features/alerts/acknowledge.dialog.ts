import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { Alert } from '../../core/models';

/** Pide una nota opcional al reconocer una alerta. Devuelve { note } o undefined si se cancela. */
@Component({
  standalone: true,
  imports: [FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Reconocer alerta</h2>
    <mat-dialog-content>
      <p>{{ alert.title }}</p>
      <p class="muted small">Reconocer indica que alguien se hace cargo. La alerta se resuelve sola cuando deja de cumplirse la condición.</p>
      <mat-form-field style="width: 100%">
        <mat-label>Nota (opcional)</mat-label>
        <textarea matInput [(ngModel)]="note" rows="2" maxlength="500" placeholder="Ej: taller agendado para el lunes"></textarea>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-flat-button color="primary" [mat-dialog-close]="{ note: note.trim() }">Reconocer</button>
    </mat-dialog-actions>
  `,
})
export class AcknowledgeDialog {
  alert: Alert = inject(MAT_DIALOG_DATA);
  note = '';
}
