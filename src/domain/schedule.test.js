import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../services/firebase.js', () => ({ db: {}, ref: vi.fn(), onValue: vi.fn(), set: vi.fn() }));
import { store } from '../state/store.js';
import { DEFAULT_EMPLOYEES } from '../config/employees.js';
import { DEFAULT_SHIFTS } from '../config/shifts.js';
import { buildWeek, regenSchedule } from './schedule.js';
import { cellHours } from './cell.js';
import { CLOSE24 } from '../config/constants.js';

beforeEach(() => {
  store.EMPLOYEES = structuredClone(DEFAULT_EMPLOYEES);
  store.SH = structuredClone(DEFAULT_SHIFTS);
});

describe('generation hard invariants', () => {
  it.each([-52, -7, -1, 0, 1, 2, 3, 4, 12, 52])('generates deterministic valid week %i', wo => {
    const schedule = buildWeek(wo);
    expect(buildWeek(wo)).toEqual(schedule);
    schedule.forEach((row, pi) => {
      expect(row.reduce((sum, cell) => sum + cellHours(cell), 0)).toBe(40);
      const fd = store.EMPLOYEES[pi].freeDay;
      expect(row[fd].id).toBe('OFF');
      expect(['PRE', 'PRE2']).toContain(row[fd === 0 ? 6 : fd - 1].id);
      if (fd !== 4) expect(row[fd + 1].id).toBe(CLOSE24.has(fd + 1) ? 'POSTF' : 'POST');
    });
    for (let di = 0; di < 7; di++) {
      expect(schedule.filter(row => store.SH[row[di].id].start === 9)).toHaveLength(1);
      expect(schedule.filter(row => store.SH[row[di].id].end === (CLOSE24.has(di) ? 24 : 23))).toHaveLength(2);
    }
  });
  it('fails explicitly for an infeasible team without mutating the current schedule', () => {
    store.EMPLOYEES = [structuredClone(DEFAULT_EMPLOYEES[0])];
    store.schedule = [[{ id: 'OFF' }]];
    const previous = structuredClone(store.schedule);
    expect(() => regenSchedule()).toThrow();
    expect(store.schedule).toEqual(previous);
  });
  it('rejects invalid catalog and employee inputs', () => {
    store.EMPLOYEES[0].freeDay = 9;
    expect(() => buildWeek(0)).toThrow();
    store.EMPLOYEES = structuredClone(DEFAULT_EMPLOYEES);
    store.SH.M.start = '9';
    expect(() => buildWeek(0)).toThrow();
  });
  it('uses explicit catalogs without changing inputs or global state', () => {
    const employees = structuredClone(DEFAULT_EMPLOYEES);
    const shifts = structuredClone(DEFAULT_SHIFTS);
    const before = JSON.stringify({ employees, shifts });
    store.EMPLOYEES = [];
    store.SH = {};
    const schedule = buildWeek(0, employees, shifts);
    expect(schedule.every(row => row.reduce((sum, cell) => sum + cellHours(cell, shifts), 0) === 40)).toBe(true);
    expect(JSON.stringify({ employees, shifts })).toBe(before);
    expect(store.SH).toEqual({});
    expect(store.EMPLOYEES).toEqual([]);
  });
});
