import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * Endpoints donde un 401 significa "credenciales incorrectas" y no "sesión vencida":
 * en el cambio de clave, una clave actual errónea no debe cerrar la sesión.
 */
const CREDENTIAL_CHECKS = ['/auth/login', '/auth/password'];

/**
 * Agrega el token a cada request. Si la API responde 401 (token vencido o usuario
 * desactivado) se cierra la sesión y se vuelve al login.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token;
  const isLogin = req.url.endsWith('/auth/login');
  const isCredentialCheck = CREDENTIAL_CHECKS.some((path) => req.url.endsWith(path));
  const request = token && !isLogin ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(request).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && !isCredentialCheck && auth.isLoggedIn()) auth.logout('expired');
      return throwError(() => err);
    }),
  );
};
