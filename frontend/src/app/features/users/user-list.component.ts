import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { NotifyService } from '../../core/notify.service';
import { Role, User } from '../../core/models';
import { ROLES } from '../../core/labels';
import { LabelPipe } from '../../shared/label.pipe';
import { UserFormDialog } from './user-form.dialog';

/** Administración de usuarios (solo admin): alta, cambio de rol y activar/desactivar. */
@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [DatePipe, MatTableModule, MatSelectModule, MatSlideToggleModule, MatButtonModule, MatIconModule, MatProgressBarModule, LabelPipe],
  template: `
    <div class="page-header">
      <div><h1>Usuarios</h1><p>{{ users().length }} usuario(s)</p></div>
      <button mat-flat-button color="primary" (click)="create()"><mat-icon>person_add</mat-icon>Nuevo usuario</button>
    </div>
    <div class="table-wrap">
      @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
      <table mat-table [dataSource]="users()">
        <ng-container matColumnDef="name">
          <th mat-header-cell *matHeaderCellDef>Nombre</th>
          <td mat-cell *matCellDef="let u">
            {{ u.fullName }} @if (u.id === me) { <span class="muted small">(tú)</span> }
            <div class="small muted">{{ u.email }}</div>
          </td>
        </ng-container>
        <ng-container matColumnDef="role">
          <th mat-header-cell *matHeaderCellDef>Rol</th>
          <td mat-cell *matCellDef="let u">
            <mat-select [value]="u.role" (selectionChange)="update(u, { role: $event.value })" [disabled]="u.id === me" style="width: 150px">
              @for (r of roles; track r) { <mat-option [value]="r">{{ r | label }}</mat-option> }
            </mat-select>
          </td>
        </ng-container>
        <ng-container matColumnDef="lastLogin">
          <th mat-header-cell *matHeaderCellDef>Último ingreso</th>
          <td mat-cell *matCellDef="let u">{{ u.lastLoginAt ? (u.lastLoginAt | date: 'dd-MM-yyyy HH:mm') : 'Nunca' }}</td>
        </ng-container>
        <ng-container matColumnDef="active">
          <th mat-header-cell *matHeaderCellDef>Activo</th>
          <td mat-cell *matCellDef="let u">
            <mat-slide-toggle [checked]="u.active" (change)="update(u, { active: $event.checked })" [disabled]="u.id === me" />
          </td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let row; columns: columns" [class.muted]="!row.active"></tr>
      </table>
    </div>
  `,
})
export class UserListComponent implements OnInit {
  private api = inject(ApiService);
  private dialog = inject(MatDialog);
  private notify = inject(NotifyService);

  readonly roles = ROLES;
  readonly columns = ['name', 'role', 'lastLogin', 'active'];
  /** El backend no deja que un admin se desactive ni se quite el rol a sí mismo; aquí se deshabilita. */
  readonly me = inject(AuthService).user()?.id;
  users = signal<User[]>([]);
  loading = signal(false);

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.api.users().subscribe({
      next: (u) => { this.users.set(u); this.loading.set(false); },
      error: (err) => { this.notify.error(err); this.loading.set(false); },
    });
  }

  create() {
    this.dialog.open(UserFormDialog, { width: '560px' }).afterClosed().subscribe((u?: User) => {
      if (u) { this.notify.ok(`Usuario ${u.email} creado`); this.load(); }
    });
  }

  update(u: User, change: { role?: Role; active?: boolean }) {
    this.api.updateUser(u.id, change).subscribe({
      next: () => {
        this.notify.ok(change.active === false ? `${u.fullName} desactivado: ya no puede ingresar` : 'Usuario actualizado');
        this.load();
      },
      error: (err) => { this.notify.error(err); this.load(); },
    });
  }
}
