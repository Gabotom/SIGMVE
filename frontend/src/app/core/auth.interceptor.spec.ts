import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  const auth = { token: 'abc', isLoggedIn: () => true, logout: jasmine.createSpy('logout') };

  beforeEach(() => {
    auth.logout.calls.reset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  it('agrega el token Bearer', () => {
    http.get('/api/vehicles').subscribe();
    expect(backend.expectOne('/api/vehicles').request.headers.get('Authorization')).toBe('Bearer abc');
  });

  it('un 401 en una consulta normal cierra la sesión (token vencido o usuario desactivado)', () => {
    http.get('/api/vehicles').subscribe({ error: () => {} });
    backend.expectOne('/api/vehicles').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(auth.logout).toHaveBeenCalledWith('expired');
  });

  it('un 401 al cambiar la clave (clave actual incorrecta) NO cierra la sesión', () => {
    http.patch('/api/auth/password', {}).subscribe({ error: () => {} });
    backend.expectOne('/api/auth/password').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(auth.logout).not.toHaveBeenCalled();
  });
});
