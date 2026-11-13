import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatBadgeModule } from '@angular/material/badge';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { filter, interval, startWith } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { ApiService } from '../core/api.service';
import { LabelPipe } from '../shared/label.pipe';
import { Role } from '../core/models';

interface NavItem { path: string; icon: string; text: string; roles?: Role[] }

/** Cada cuánto se refresca el contador de alertas de la campana. */
const ALERTS_POLL_MS = 60_000;

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive, MatSidenavModule, MatToolbarModule, MatListModule,
    MatIconModule, MatButtonModule, MatBadgeModule, MatMenuModule, MatTooltipModule, LabelPipe,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent implements OnInit {
  auth = inject(AuthService);
  private api = inject(ApiService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private breakpoints = inject(BreakpointObserver);

  isMobile = signal(false);
  menuOpen = signal(true);
  unacknowledged = signal(0);

  nav: NavItem[] = [
    { path: '/dashboard', icon: 'dashboard', text: 'Dashboard' },
    { path: '/vehiculos', icon: 'local_shipping', text: 'Vehículos' },
    { path: '/mantenciones', icon: 'build', text: 'Mantenciones' },
    { path: '/incidencias', icon: 'report_problem', text: 'Incidencias' },
    { path: '/alertas', icon: 'notifications', text: 'Alertas' },
    { path: '/usuarios', icon: 'group', text: 'Usuarios', roles: ['admin'] },
  ];

  visibleNav() {
    return this.nav.filter((n) => !n.roles || this.auth.hasRole(...n.roles));
  }

  ngOnInit() {
    this.breakpoints
      .observe('(max-width: 900px)')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((r) => {
        this.isMobile.set(r.matches);
        this.menuOpen.set(!r.matches);
      });

    // Contador de la campana: al entrar, cada minuto y después de cada navegación
    // (así se actualiza apenas alguien reconoce una alerta o cambia una mantención).
    const navigations = this.router.events.pipe(filter((e) => e instanceof NavigationEnd));
    interval(ALERTS_POLL_MS)
      .pipe(startWith(0), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refreshAlerts());
    navigations.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.refreshAlerts();
      if (this.isMobile()) this.menuOpen.set(false);
    });
  }

  private refreshAlerts() {
    if (!this.auth.isLoggedIn()) return;
    // Si falla (p. ej. la API se reinicia) se ignora: se reintenta en el próximo ciclo.
    this.api.alertSummary().subscribe({ next: (s) => this.unacknowledged.set(s.unacknowledged), error: () => {} });
  }
}
