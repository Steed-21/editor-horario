import { describe, it, expect } from 'vitest';
import { shiftGrossHours, shiftNetHours } from './shift.js';

describe('shiftGrossHours', () => {
  it('OFF → 0 horas brutas', () => {
    expect(shiftGrossHours({ id: 'OFF', start: 0, end: 0 })).toBe(0);
  });

  it('turno Mañana (9-17) → 8 horas brutas', () => {
    expect(shiftGrossHours({ id: 'M', start: 9, end: 17 })).toBe(8);
  });

  it('turno Cierre V/S (16-24) → 8 horas brutas', () => {
    expect(shiftGrossHours({ id: 'CF', start: 16, end: 24 })).toBe(8);
  });
});

describe('shiftNetHours', () => {
  it('OFF → 0 horas netas', () => {
    expect(shiftNetHours({ id: 'OFF', start: 0, end: 0 })).toBe(0);
  });

  it('turno con descanso por defecto resta 1h', () => {
    // M: 9-17 = 8h brutas, defaultBs=13 → descansa 1h → 7h netas
    expect(shiftNetHours({ id: 'M', start: 9, end: 17, defaultBs: 13 })).toBe(7);
  });

  it('turno con descanso de 30 min resta 0.5h', () => {
    expect(shiftNetHours({ id: 'X', start: 9, end: 17, defaultBs: 13, defaultBd: 0.5 })).toBe(7.5);
  });

  it('turno sin descanso devuelve brutas', () => {
    expect(shiftNetHours({ id: 'S', start: 11, end: 17, defaultBs: null })).toBe(6);
  });

  it('turno con start == end (baja/ausencia) → 0', () => {
    expect(shiftNetHours({ id: 'X', start: 0, end: 0, defaultBs: null })).toBe(0);
  });
});
