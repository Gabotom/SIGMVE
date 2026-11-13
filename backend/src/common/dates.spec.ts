import { addDays, daysBetween, localDate } from './dates';

describe('dates', () => {
  it('localDate usa la hora de Chile, no UTC (22:30 del 16 en Chile = 01:30 del 17 en UTC)', () => {
    const at = new Date('2026-10-17T01:30:00Z');
    expect(at.toISOString().slice(0, 10)).toBe('2026-10-17');
    expect(localDate(at, 'America/Santiago')).toBe('2026-10-16');
  });

  it('daysBetween y addDays cruzan meses sin errores', () => {
    expect(daysBetween('2026-10-30', '2026-11-02')).toBe(3);
    expect(daysBetween('2026-11-02', '2026-10-30')).toBe(-3);
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  });
});
