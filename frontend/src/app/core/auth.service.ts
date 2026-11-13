import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { LoginResponse, Role } from './models';

const STORAGE_KEY = 'sigmve.session';

type Session = LoginResponse;

/**
 * Sesión del usuario. El token se guarda en localStorage para no perder la sesión al recargar.
 * (El backend igual valida en cada request que el usuario siga activo.)
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private session = signal<Session | null>(this.restore());

  readonly user = computed(() => this.session()?.user ?? null);
  readonly isLoggedIn = computed(() => !!this.session());
  readonly role = computed<Role | null>(() => this.session()?.user.role ?? null);
  /** admin y operator pueden registrar y modificar; viewer solo consulta. */
  readonly canEdit = computed(() => this.role() === 'admin' || this.role() === 'operator');
  readonly isAdmin = computed(() => this.role() === 'admin');

  get token() { return this.session()?.accessToken ?? null; }

  login(email: string, password: string) {
    return this.http.post<LoginResponse>(`${environment.apiUrl}/auth/login`, { email, password }).pipe(
      tap((res) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(res));
        this.session.set(res);
      }),
    );
  }

  logout(reason?: 'expired') {
    localStorage.removeItem(STORAGE_KEY);
    this.session.set(null);
    this.router.navigate(['/login'], reason ? { queryParams: { motivo: reason } } : {});
  }

  hasRole(...roles: Role[]) {
    const r = this.role();
    return !!r && roles.includes(r);
  }

  private restore(): Session | null {
    try {
      const s: Session | null = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
      if (!s?.accessToken || this.isExpired(s.accessToken)) return null;
      return s;
    } catch {
      return null;
    }
  }

  /** Lee el campo exp del JWT (sin verificar la firma: eso lo hace el backend). */
  private isExpired(token: string) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return typeof payload.exp === 'number' && payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }
}
