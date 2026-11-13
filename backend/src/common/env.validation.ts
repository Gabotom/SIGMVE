/**
 * Valida las variables de entorno al arrancar. Si falta algo crítico, la API no levanta
 * (es mejor fallar al inicio que correr con un secreto JWT por defecto).
 */
const INSECURE_SECRETS = ['cambia_este_secreto', 'secret', 'changeme'];

export function validateEnv(env: Record<string, unknown>) {
  const errors: string[] = [];
  const secret = String(env.JWT_SECRET ?? '');
  const isProd = env.NODE_ENV === 'production';

  if (!secret) errors.push('JWT_SECRET es obligatorio');
  else if (isProd && (secret.length < 32 || INSECURE_SECRETS.includes(secret))) {
    errors.push('En producción JWT_SECRET debe tener al menos 32 caracteres y no ser el valor de ejemplo');
  }
  if (isProd && env.ADMIN_PASSWORD === 'Admin1234') {
    errors.push('En producción ADMIN_PASSWORD no puede ser la clave de ejemplo');
  }
  // Umbrales del Módulo 5 (alertas): si vienen, deben ser números no negativos.
  for (const key of ['ALERT_UPCOMING_DAYS', 'ALERT_OVERDUE_CRITICAL_DAYS', 'ALERT_INCIDENT_STALE_HOURS', 'ALERT_MIN_AVAILABILITY_PCT']) {
    const raw = env[key];
    if (raw !== undefined && raw !== '' && !(Number(raw) >= 0)) errors.push(`${key} debe ser un número mayor o igual a 0`);
  }
  if (errors.length) throw new Error(`Configuración inválida:\n - ${errors.join('\n - ')}`);
  return env;
}
