/** Textos para mostrar en pantalla cada valor de la API (la API usa snake_case sin tildes). */
export const LABELS: Record<string, string> = {
  // roles
  admin: 'Administrador', operator: 'Operador', viewer: 'Consulta',
  // tipos de vehículo
  bomba: 'Bomba', ambulancia: 'Ambulancia', rescate: 'Rescate', patrulla: 'Patrulla', otro: 'Otro',
  // estados de vehículo
  disponible: 'Disponible', en_emergencia: 'En emergencia', en_mantencion: 'En mantención', fuera_de_servicio: 'Fuera de servicio',
  // mantenciones
  preventiva: 'Preventiva', correctiva: 'Correctiva',
  programada: 'Programada', en_proceso: 'En proceso', completada: 'Completada', cancelada: 'Cancelada',
  // incidencias
  baja: 'Baja', media: 'Media', alta: 'Alta', critica: 'Crítica',
  abierta: 'Abierta', en_atencion: 'En atención', resuelta: 'Resuelta', descartada: 'Descartada',
  // alertas
  mantencion_vencida: 'Mantención vencida', mantencion_proxima: 'Mantención próxima', incidencia_critica: 'Incidencia crítica',
  incidencia_sin_atender: 'Incidencia sin atender', baja_disponibilidad: 'Baja disponibilidad',
  info: 'Info', advertencia: 'Advertencia', activa: 'Activa', reconocida: 'Reconocida',
};

export const label = (value: string | null | undefined) => (value ? LABELS[value] ?? value : '');

/** Color de la etiqueta (clase CSS .tone-*) según el valor. */
const TONES: Record<string, 'ok' | 'warn' | 'bad' | 'info' | 'muted'> = {
  disponible: 'ok', completada: 'ok', resuelta: 'ok',
  en_emergencia: 'info', programada: 'info', en_atencion: 'info', info: 'info', reconocida: 'info',
  en_mantencion: 'warn', en_proceso: 'warn', media: 'warn', alta: 'warn', advertencia: 'warn', abierta: 'warn', activa: 'warn',
  fuera_de_servicio: 'bad', critica: 'bad',
  cancelada: 'muted', descartada: 'muted', baja: 'muted',
};
export const tone = (value: string | null | undefined) => (value ? TONES[value] ?? 'muted' : 'muted');

export const VEHICLE_TYPES = ['bomba', 'ambulancia', 'rescate', 'patrulla', 'otro'] as const;
export const VEHICLE_STATUSES = ['disponible', 'en_emergencia', 'en_mantencion', 'fuera_de_servicio'] as const;
/** en_mantencion no se asigna a mano (lo pone el sistema al iniciar una mantención). */
export const MANUAL_VEHICLE_STATUSES = ['disponible', 'en_emergencia', 'fuera_de_servicio'] as const;
export const MAINTENANCE_TYPES = ['preventiva', 'correctiva'] as const;
export const MAINTENANCE_STATUSES = ['programada', 'en_proceso', 'completada', 'cancelada'] as const;
/** Igual que MAINTENANCE_TRANSITIONS del backend. */
export const MAINTENANCE_TRANSITIONS: Record<string, string[]> = {
  programada: ['en_proceso', 'completada', 'cancelada'],
  en_proceso: ['completada', 'cancelada'],
  completada: [],
  cancelada: [],
};
export const INCIDENT_SEVERITIES = ['baja', 'media', 'alta', 'critica'] as const;
export const INCIDENT_STATUSES = ['abierta', 'en_atencion', 'resuelta', 'descartada'] as const;
/** Igual que INCIDENT_TRANSITIONS del backend. */
export const INCIDENT_TRANSITIONS: Record<string, string[]> = {
  abierta: ['en_atencion', 'resuelta', 'descartada'],
  en_atencion: ['abierta', 'resuelta', 'descartada'],
  resuelta: [],
  descartada: [],
};
export const ALERT_TYPES = ['mantencion_vencida', 'mantencion_proxima', 'incidencia_critica', 'incidencia_sin_atender', 'baja_disponibilidad'] as const;
export const ALERT_SEVERITIES = ['info', 'advertencia', 'critica'] as const;
export const ROLES = ['admin', 'operator', 'viewer'] as const;
