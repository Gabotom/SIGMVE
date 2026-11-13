import { label, tone } from './labels';

describe('labels', () => {
  it('traduce los valores de la API', () => {
    expect(label('fuera_de_servicio')).toBe('Fuera de servicio');
    expect(label('mantencion_vencida')).toBe('Mantención vencida');
    expect(label('desconocido')).toBe('desconocido');
  });

  it('asigna colores según gravedad', () => {
    expect(tone('disponible')).toBe('ok');
    expect(tone('critica')).toBe('bad');
    expect(tone('en_mantencion')).toBe('warn');
  });
});
