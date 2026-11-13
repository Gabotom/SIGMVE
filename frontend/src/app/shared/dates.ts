/** Fecha local 'YYYY-MM-DD' (la API trabaja con fechas de calendario de Chile, no UTC). */
export function today(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return toIsoDate(d);
}

/** Date -> 'YYYY-MM-DD' usando la fecha local (toISOString usaría UTC y cambiaría el día de noche). */
export function toIsoDate(d: Date | null | undefined): string {
  if (!d) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
