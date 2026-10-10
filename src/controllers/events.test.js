import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../services/firebase.js', () => ({ db: {}, auth: {}, ref: vi.fn(), onValue: vi.fn(), set: vi.fn(() => Promise.resolve()), onAuthStateChanged: vi.fn(), signOut: vi.fn(), signInWithEmailAndPassword: vi.fn() }));
vi.mock('../ui/layout.js', () => ({ render: vi.fn() }));
vi.mock('../ui/components/log.js', () => ({ log: vi.fn() }));
import { setupEvents } from './events.js';
import { store } from '../state/store.js';
import { set } from '../services/firebase.js';
import { DEFAULT_SHIFTS } from '../config/shifts.js';
import { DEFAULT_EMPLOYEES } from '../config/employees.js';
import { deleteShift } from '../ui/modals/shiftEditor.js';

let listeners;
beforeEach(() => {
  vi.clearAllMocks();
  listeners = {};
  vi.stubGlobal('window', {});
  vi.stubGlobal('localStorage', { setItem: vi.fn() });
  vi.stubGlobal('document', { getElementById: id => ({ style: {}, addEventListener: (event, fn) => { listeners[id + ':' + event] = fn; } }), querySelectorAll: () => [] });
  Object.assign(store, { weekRosters: {}, scheduleRoster: null, employeeCounter: 0, weekStatus: 'missing', SH: structuredClone(DEFAULT_SHIFTS), EMPLOYEES: [{ name: 'A', freeDay: 0 }], baseDate: '2026-05-11', selectedWeek: null, pendingWrite: null, persistenceStatus: 'listener', wo: 0, schedule: [Array.from({ length: 7 }, () => ({ id: 'OFF' }))], edited: [Array(7).fill(false)], weeks: {}, currentEdit: null });
});
it.each([true, false])('missing-week browsing is read-only with isAdmin=%s', admin => {
  store.isAdmin = admin;
  const weeks = structuredClone(store.weeks);
  setupEvents();
  listeners['bNext:click']();
  expect(store.schedule).toEqual([]);
  expect(store.edited).toEqual([]);
  expect(store.weeks).toEqual(weeks);
  expect(set).not.toHaveBeenCalled();
  expect(localStorage.setItem).not.toHaveBeenCalled();
});
it('blocks deletion of shifts referenced only in historical weeks', () => {
  store.isAdmin = true;
  store.SH.X1 = { ...store.SH.M, id: 'X1', builtin: false };
  store.EMPLOYEES = structuredClone(DEFAULT_EMPLOYEES);
  store.schedule = DEFAULT_EMPLOYEES.map(() => Array.from({ length: 7 }, () => ({ id: 'M', bs: 13, bd: 1 })));
  store.weeks['2026-05-04'] = { schedule: structuredClone(store.schedule) };
  store.weeks['2026-05-04'].schedule[0][0].id = 'X1';
  deleteShift('X1');
  expect(store.SH.X1).toBeDefined();
  expect(set).not.toHaveBeenCalled();
});
it('blocks reset when it would erase historical custom shift references', () => {
  store.isAdmin = true;
  store.SH.X1 = { ...store.SH.M, id: 'X1', builtin: false };
  store.EMPLOYEES = structuredClone(DEFAULT_EMPLOYEES);
  store.schedule = DEFAULT_EMPLOYEES.map(() => Array.from({ length: 7 }, () => ({ id: 'M', bs: 13, bd: 1 })));
  store.weeks['2026-05-04'] = { schedule: structuredClone(store.schedule) };
  store.weeks['2026-05-04'].schedule[0][0].id = 'X1';
  setupEvents();
  listeners['bReset:click']();
  expect(store.SH.X1).toBeDefined();
  expect(set).not.toHaveBeenCalled();
});

it.each(['shift', 'employee'])('blocks reset from silently replacing historical %s catalogs', change => {
  store.isAdmin = true;
  store.EMPLOYEES = structuredClone(DEFAULT_EMPLOYEES);
  const schedule = DEFAULT_EMPLOYEES.map(() => Array.from({ length: 7 }, () => ({ id: 'M', bs: 13, bd: 1 })));
  store.schedule = structuredClone(schedule);
  store.weeks['2026-05-04'] = { schedule };
  if (change === 'shift') store.SH.M.end = 18;
  else store.EMPLOYEES[0].name = 'Renamed';
  const previous = structuredClone({ shifts: store.SH, employees: store.EMPLOYEES, weeks: store.weeks });
  setupEvents();
  listeners['bReset:click']();
  expect({ shifts: store.SH, employees: store.EMPLOYEES, weeks: store.weeks }).toEqual(previous);
  expect(set).not.toHaveBeenCalled();
});

it('loads an existing week without writing or mutating saved records', () => {
  store.isAdmin = true;
  store.weeks['2026-05-18'] = { schedule: structuredClone(store.schedule) };
  const previous = structuredClone(store.weeks);
  setupEvents();
  listeners['bNext:click']();
  expect(store.schedule).toEqual(previous['2026-05-18'].schedule.map(row => row.map(cell => ({ ...cell, bs: null, bd: 1 }))));
  expect(store.weeks).toEqual(previous);
  expect(set).not.toHaveBeenCalled();
});

it('allows deletion of an unused custom shift without altering saved cells', () => {
  store.isAdmin = true;
  store.SH.X1 = { ...store.SH.M, id: 'X1', builtin: false };
  store.weeks['2026-05-04'] = { schedule: structuredClone(store.schedule) };
  const previous = structuredClone(store.weeks['2026-05-04']);
  deleteShift('X1');
  expect(store.SH.X1).toBeUndefined();
  expect(store.weeks['2026-05-04']).toEqual(previous);
  expect(set).toHaveBeenCalledTimes(1);
});

it('allows explicit admin generation for a missing week', () => {
  store.isAdmin = true;
  store.schedule = [];
  store.edited = [];
  setupEvents();
  listeners['bReset:click']();
  expect(store.schedule).toHaveLength(DEFAULT_EMPLOYEES.length);
  expect(store.weeks['2026-05-11'].schedule).toEqual(store.schedule);
  expect(set).toHaveBeenCalledTimes(1);
});

it('does not let a reader invoke reset through its client handler', () => {
  store.isAdmin = false;
  const previous = structuredClone(store.schedule);
  setupEvents();
  listeners['bReset:click']();
  expect(store.schedule).toEqual(previous);
  expect(set).not.toHaveBeenCalled();
});
