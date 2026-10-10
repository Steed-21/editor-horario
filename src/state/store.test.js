import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../services/firebase.js', () => ({ db: {}, ref: vi.fn(), onValue: vi.fn(), set: vi.fn(() => Promise.resolve()) }));
import { store, syncState, saveState, loadSelectedWeek } from './store.js';
import { onValue, set } from '../services/firebase.js';
import { DEFAULT_EMPLOYEES } from '../config/employees.js';
import { DEFAULT_SHIFTS } from '../config/shifts.js';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('window', { _renderUI: vi.fn() });
  vi.stubGlobal('localStorage', { getItem: vi.fn(() => null), setItem: vi.fn() });
  Object.assign(store, { EMPLOYEES: structuredClone(DEFAULT_EMPLOYEES), SH: structuredClone(DEFAULT_SHIFTS), baseDate: '2026-05-11', selectedWeek: null, persistenceStatus: 'loading', pendingWrite: null, activeEditor: null, wo: 0, weeks: {}, schedule: DEFAULT_EMPLOYEES.map(() => Array.from({ length: 7 }, () => ({ id: 'M', bs: 13, bd: 1 }))), edited: [[true]], currentEdit: { pi: 0, di: 0 } });
});

it.each([{ weeks: {} }, {}, null])('clears stale selected-week state for snapshot %j', snapshot => {
  syncState();
  onValue.mock.calls[0][1]({ val: () => snapshot });
  expect(store.schedule).toEqual([]);
  expect(store.edited).toEqual([]);
  expect(store.currentEdit).toBeNull();
  expect(window._renderUI).toHaveBeenCalled();
  expect(set).not.toHaveBeenCalled();
});

it('clears an active edit when an authoritative week replaces it', () => {
  const schedule = structuredClone(store.schedule);
  syncState();
  onValue.mock.calls[0][1]({ val: () => ({ weeks: { '2026-05-11': { schedule } }, logEntries: [{ ts: 'remote', msg: 'updated', type: 'ok' }] }) });
  expect(store.schedule).toEqual(schedule);
  expect(store.edited).toEqual(schedule.map(row => row.map(() => false)));
  expect(store.currentEdit).toBeNull();
  expect(store.logEntries[0].msg).toBe('updated');
});

it.each([[[{ id: 'missing' }]], 'invalid', null])('rejects a malformed selected week %j without stale data', schedule => {
  store.weeks['2026-05-11'] = { schedule };
  loadSelectedWeek();
  expect(store.weekStatus).toBe('invalid');
  expect(store.schedule).toEqual([]);
  expect(store.currentEdit).toBeNull();
});
it('blocks persistence of unresolved historical references', () => {
  store.isAdmin = true;
  store.weeks['2026-05-04'] = { schedule: [[{ id: 'missing' }]] };
  expect(() => saveState()).toThrow('unresolved shift references');
  expect(set).not.toHaveBeenCalled();
  expect(localStorage.setItem).not.toHaveBeenCalled();
});
it('keeps cache and listener deliveries unverified without write acknowledgement', () => {
  localStorage.getItem.mockReturnValue(JSON.stringify({ weeks: {} }));
  syncState();
  expect(store.snapshotSource).toBe('cached');
  onValue.mock.calls[0][1]({ val: () => ({ weeks: {} }) });
  expect(store.snapshotSource).toBe('listener');
  expect(store.persistenceStatus).toBe('listener');
});
