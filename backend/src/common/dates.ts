/**
 * Fechas de calendario en la zona horaria de la operación (por defecto America/Santiago).
 * Antes se usaba new Date().toISOString(), que entrega la fecha en UTC: entre las 21:00 y
 * las 23:59 de Chile ya es "mañana" en UTC, y una mantención quedaba con fecha de término
 * del día siguiente (o se marcaría vencida unas horas antes de tiempo).
 */
export const DEFAULT_TIMEZONE = 'America/Santiago';

const appTimezone = () => process.env.APP_TIMEZONE || DEFAULT_TIMEZONE;

/** Fecha local 'YYYY-MM-DD' de un instante (por defecto, ahora). */
export function localDate(at: Date = new Date(), timeZone: string = appTimezone()): string {
  // en-CA formatea como YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

/** Días de calendario entre dos fechas 'YYYY-MM-DD' (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** Suma días a una fecha 'YYYY-MM-DD'. */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}
