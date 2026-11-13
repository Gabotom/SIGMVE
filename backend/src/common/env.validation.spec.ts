import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  it('exige JWT_SECRET', () => {
    expect(() => validateEnv({})).toThrow('JWT_SECRET es obligatorio');
  });

  it('en desarrollo acepta el secreto de ejemplo', () => {
    expect(() => validateEnv({ JWT_SECRET: 'cambia_este_secreto' })).not.toThrow();
  });

  it('en producción rechaza el secreto de ejemplo y la clave admin por defecto', () => {
    expect(() => validateEnv({ NODE_ENV: 'production', JWT_SECRET: 'cambia_este_secreto', ADMIN_PASSWORD: 'Admin1234' })).toThrow(/JWT_SECRET[\s\S]*ADMIN_PASSWORD/);
  });

  it('en producción acepta un secreto largo', () => {
    expect(() => validateEnv({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(48), ADMIN_PASSWORD: 'OtraClave99' })).not.toThrow();
  });

  it('rechaza umbrales de alertas que no son números', () => {
    expect(() => validateEnv({ JWT_SECRET: 's', ALERT_UPCOMING_DAYS: 'siete' })).toThrow('ALERT_UPCOMING_DAYS');
    expect(() => validateEnv({ JWT_SECRET: 's', ALERT_MIN_AVAILABILITY_PCT: '-5' })).toThrow('ALERT_MIN_AVAILABILITY_PCT');
    expect(() => validateEnv({ JWT_SECRET: 's', ALERT_UPCOMING_DAYS: '3' })).not.toThrow();
  });
});
