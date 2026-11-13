import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/guards';
import { ShellComponent } from './layout/shell.component';

export const routes: Routes = [
  { path: 'login', canActivate: [guestGuard], loadComponent: () => import('./features/login/login.component').then((m) => m.LoginComponent) },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', title: 'Dashboard · SIGMVE', loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent) },
      { path: 'vehiculos', title: 'Vehículos · SIGMVE', loadComponent: () => import('./features/vehicles/vehicle-list.component').then((m) => m.VehicleListComponent) },
      { path: 'vehiculos/:id', title: 'Vehículo · SIGMVE', loadComponent: () => import('./features/vehicles/vehicle-detail.component').then((m) => m.VehicleDetailComponent) },
      { path: 'mantenciones', title: 'Mantenciones · SIGMVE', loadComponent: () => import('./features/maintenances/maintenance-list.component').then((m) => m.MaintenanceListComponent) },
      { path: 'incidencias', title: 'Incidencias · SIGMVE', loadComponent: () => import('./features/incidents/incident-list.component').then((m) => m.IncidentListComponent) },
      { path: 'alertas', title: 'Alertas · SIGMVE', loadComponent: () => import('./features/alerts/alert-list.component').then((m) => m.AlertListComponent) },
      { path: 'usuarios', title: 'Usuarios · SIGMVE', canActivate: [roleGuard('admin')], loadComponent: () => import('./features/users/user-list.component').then((m) => m.UserListComponent) },
      { path: 'cuenta', title: 'Mi cuenta · SIGMVE', loadComponent: () => import('./features/account/account.component').then((m) => m.AccountComponent) },
    ],
  },
  { path: '**', redirectTo: '' },
];
