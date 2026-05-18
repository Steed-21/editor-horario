import { describe, it, expect } from 'vitest';
import { getMonday, getDatesForWeek, formatHour } from './dateUtils.js';

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
