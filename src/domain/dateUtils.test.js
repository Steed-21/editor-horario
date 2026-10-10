import { describe, it, expect } from 'vitest';
import { getMonday, getDatesForWeek, formatHour, addWeeks, weekOffset, isCivilDate } from './dateUtils.js';

describe('getMonday', () => {
  it('devuelve el lunes de la misma semana para un miércoles', () => {
    // 2026-05-13 es miércoles
    expect(getMonday('2026-05-13')).toBe('2026-05-11');
  });

  it('devuelve el lunes anterior para un domingo', () => {
    // 2026-05-17 es domingo
    expect(getMonday('2026-05-17')).toBe('2026-05-11');
  });

  it('devuelve el mismo día si ya es lunes', () => {
    expect(getMonday('2026-05-11')).toBe('2026-05-11');
  });
});

describe('formatHour', () => {
  it('formatea entero como H:00', () => {
    expect(formatHour(9)).toBe('9:00');
  });

  it('formatea media hora como H:30', () => {
    expect(formatHour(13.5)).toBe('13:30');
  });

  it('formatea 24 sin sufijo (cierre nocturno)', () => {
    expect(formatHour(24)).toBe('24');
  });

  it('devuelve cadena vacía para null', () => {
    expect(formatHour(null)).toBe('');
  });
});

describe('getDatesForWeek', () => {
  it('devuelve 7 fechas consecutivas desde el lunes base', () => {
    const dates = getDatesForWeek('2026-05-11', 0);
    expect(dates).toHaveLength(7);
    expect(dates[0].str).toBe('11/05');
    expect(dates[6].str).toBe('17/05');
  });

  it('aplica el offset de semanas (wo=1 → semana siguiente)', () => {
    const dates = getDatesForWeek('2026-05-11', 1);
    expect(dates[0].str).toBe('18/05');
    expect(dates[6].str).toBe('24/05');
  });

  it('aplica offset negativo (wo=-1 → semana anterior)', () => {
    const dates = getDatesForWeek('2026-05-11', -1);
    expect(dates[0].str).toBe('04/05');
  });
});


describe('civil calendar arithmetic', () => {
  it.each([
    ['2026-10-05', 1, '2026-10-12'],
    ['2026-10-12', -1, '2026-10-05'],
    ['2026-03-23', 1, '2026-03-30'],
    ['2026-10-19', 1, '2026-10-26'],
    ['2026-12-28', 1, '2027-01-04'],
    ['2024-02-26', 1, '2024-03-04'],
  ])('shifts civil key %s by %i weeks consistently', (key, offset, expected) => {
    expect(addWeeks(key, offset)).toBe(expected);
    expect(addWeeks(expected, -offset)).toBe(key);
    expect(weekOffset(key, expected)).toBe(offset);
  });
  it('renders leap day and month rollover', () => {
    expect(getDatesForWeek('2024-02-26', 0).map(d => d.str))
      .toEqual(['26/02', '27/02', '28/02', '29/02', '01/03', '02/03', '03/03']);
  });
  it.each(['2026-02-30', '2026-13-01', '2026-00-01', '2026-10-00', '2026-10-05T00:00:00Z', '2026-1-5', ''])('rejects invalid civil input %s without timestamp reinterpretation', key => {
    expect(isCivilDate(key)).toBe(false);
    expect(() => getMonday(key)).toThrow(RangeError);
  });
  it('handles years below 100 as civil years rather than Date constructor shortcuts', () => {
    expect(addWeeks('0099-12-28', 1)).toBe('0100-01-04');
  });
});
