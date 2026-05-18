// cell.js depende de store.SH. Mockeamos firebase para que la importación
// transitiva (store → firebase) no intente inicializar Firebase en el test.
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../services/firebase.js', () => ({
  db: {},
  auth: {},
  ref: vi.fn(),
  onValue: vi.fn(),
  set: vi.fn(),
  update: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
}));

const { store } = await import('../state/store.js');
const { DEFAULT_SHIFTS } = await import('../config/shifts.js');
const { makeCell, cellHours, cellLabel, borderClass } = await import('./cell.js');

beforeEach(() => {
  store.SH = JSON.parse(JSON.stringify(DEFAULT_SHIFTS));
});

describe('makeCell', () => {
  it('crea celda M con bs/bd por defecto del turno', () => {
    const c = makeCell('M');
    expect(c.id).toBe('M');
    expect(c.bs).toBe(13);
    expect(c.bd).toBe(1);
  });

  it('respeta el bs override', () => {
    const c = makeCell('M', 14);
    expect(c.bs).toBe(14);
  });

  it('turno S (sin descanso default) → bs es null', () => {
    const c = makeCell('S');
    expect(c.bs).toBeNull();
  });
});

describe('cellHours', () => {
  it('M con descanso 13-14 → 7h netas', () => {
    expect(cellHours({ id: 'M', bs: 13, bd: 1 })).toBe(7);
  });

  it('OFF → 0h', () => {
    expect(cellHours({ id: 'OFF' })).toBe(0);
  });

  it('M sin descanso → 8h (brutas)', () => {
    expect(cellHours({ id: 'M', bs: null, bd: 1 })).toBe(8);
  });

  it('M con descanso de 30 min → 7.5h', () => {
    expect(cellHours({ id: 'M', bs: 13, bd: 0.5 })).toBe(7.5);
  });
});

describe('borderClass', () => {
  it('OFF → border-off', () => {
    expect(borderClass({ id: 'OFF' })).toBe('border-off');
  });

  it('celda de 7h → border-7h', () => {
    expect(borderClass({ id: 'M', bs: 13, bd: 1 })).toBe('border-7h');
  });

  it('celda de 8h → border-8h', () => {
    expect(borderClass({ id: 'M', bs: null })).toBe('border-8h');
  });

  it('celda de 6h → border-6h', () => {
    expect(borderClass({ id: 'S', bs: null })).toBe('border-6h');
  });
});

describe('cellLabel', () => {
  it('OFF → "Libre"', () => {
    expect(cellLabel({ id: 'OFF' })).toBe('Libre');
  });

  it('M → "9:00–17:00"', () => {
    expect(cellLabel({ id: 'M' })).toBe('9:00–17:00');
  });

  it('CF → "16:00–24"', () => {
    expect(cellLabel({ id: 'CF' })).toBe('16:00–24');
  });
});
