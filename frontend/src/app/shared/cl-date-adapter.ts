import { Injectable } from '@angular/core';
import { NativeDateAdapter } from '@angular/material/core';

/**
 * El adaptador nativo de Angular Material interpreta lo que se escribe con Date.parse,
 * que no entiende el formato chileno "10-11-2026" (lo toma como mes-día o lo rechaza).
 * Este adaptador acepta dd-MM-yyyy y dd/MM/yyyy al escribir la fecha a mano.
 */
@Injectable()
export class ClDateAdapter extends NativeDateAdapter {
  override parse(value: unknown, parseFormat?: unknown): Date | null {
    if (typeof value === 'string') {
      const m = value.trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
      if (m) {
        const [, d, mo, y] = m.map(Number);
        const date = new Date(y, mo - 1, d);
        // Rechaza fechas imposibles como 31-02-2026
        return date.getMonth() === mo - 1 && date.getDate() === d ? date : this.invalid();
      }
    }
    return super.parse(value, parseFormat);
  }
}
