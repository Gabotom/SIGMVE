import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

/** Mensaje legible a partir de un error de la API ({ statusCode, message: string | string[] }). */
export function apiError(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'No se pudo conectar con la API. ¿Está corriendo el backend?';
    if (err.status === 429) return 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.';
    const msg = err.error?.message;
    if (Array.isArray(msg)) return msg.join('. ');
    if (typeof msg === 'string') return msg;
    if (err.status === 403) return 'No tienes permisos para esta acción';
  }
  return 'Ocurrió un error inesperado';
}

@Injectable({ providedIn: 'root' })
export class NotifyService {
  private snack = inject(MatSnackBar);

  ok(message: string) {
    this.snack.open(message, 'OK', { duration: 3000, panelClass: 'snack-ok' });
  }

  error(err: unknown) {
    this.snack.open(apiError(err), 'Cerrar', { duration: 6000, panelClass: 'snack-error' });
  }
}
