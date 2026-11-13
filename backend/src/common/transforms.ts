import { Transform } from 'class-transformer';

/** Normaliza correos: sin espacios y en minúsculas, para que "Admin@SIGMVE.cl" y "admin@sigmve.cl" sean el mismo usuario. */
export const NormalizeEmail = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value));

/** Quita espacios al inicio y al final. */
export const Trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

/** Regla de contraseña: mínimo 8 caracteres, al menos una letra y un número. */
export const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;
export const PASSWORD_MESSAGE = 'La contraseña debe tener entre 8 y 72 caracteres e incluir al menos una letra y un número';
