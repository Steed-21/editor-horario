import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../services/firebase.js', () => ({ db: {}, auth: {}, ref: vi.fn(), onValue: vi.fn(), set: vi.fn(), onAuthStateChanged: vi.fn(), signOut: vi.fn(), signInWithEmailAndPassword: vi.fn() }));
import { store, syncState, getCurrentWeekStr, loadSelectedWeek } from '../state/store.js';
import { setupEvents } from './events.js';
import { render } from '../ui/layout.js';
import { onValue, set } from '../services/firebase.js';
import { DEFAULT_SHIFTS } from '../config/shifts.js';
let nodes, handlers, snapshot;
const animate = vi.fn();
beforeEach(() => {
  vi.clearAllMocks(); nodes = {}; nodes.tContainer = { style: {}, animate, innerHTML: '', textContent: '' }; handlers = {};
  vi.stubGlobal('window', { _renderUI: render });
  vi.stubGlobal('localStorage', { getItem: vi.fn(() => null), setItem: vi.fn() });
  vi.stubGlobal('document', { getElementById: id => nodes[id] ||= { style: {}, value: '', innerHTML: '', textContent: '', addEventListener: (type, fn) => { handlers[id + ':' + type] = fn; } }, querySelector: () => null, querySelectorAll: () => [] });
  const employee = { id: 'synthetic-id', name: 'Synthetic employee', freeDay: 0, active: true };
  const week = { schedule: [Array.from({ length: 7 }, () => ({ id: 'OFF' }))], edited: [Array(7).fill(false)] };
  snapshot = { schemaVersion: 2, EMPLOYEES: [employee], SH: structuredClone(DEFAULT_SHIFTS), baseDate: '2026-10-05', weeks: { '2026-10-05': week }, weekRosters: { '2026-10-05': [employee] }, logEntries: [] };
  Object.assign(store, { baseDate: '2026-10-05', selectedWeek: null, wo: 0, isAdmin: true });
  syncState(); onValue.mock.calls[0][1]({ val: () => structuredClone(snapshot) }); setupEvents();
});
it.each(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'])('finds the exact saved civil week from %s and renders its full range', date => {
  const original = JSON.stringify(store.weeks);
  handlers['datePicker:change']({ target: { value: date } });
  expect(getCurrentWeekStr()).toBe('2026-10-05');
  expect(store.weekStatus).toBe('loaded'); expect(store.schedule).toHaveLength(1);
  expect(nodes.datePicker.value).toBe('2026-10-05');
  expect(nodes.wLabel.textContent).toBe('05/10 - 11/10');
  expect(store.currentDates.map(d => d.str)).toEqual(['05/10', '06/10', '07/10', '08/10', '09/10', '10/10', '11/10']);
  expect(JSON.stringify(store.weeks)).toBe(original); expect(set).not.toHaveBeenCalled();
});
it('navigates repeatedly across both DST boundaries without drifting or writing', () => {
  const original = JSON.stringify(store.weeks);
  handlers['bNext:click'](); expect(getCurrentWeekStr()).toBe('2026-10-12');
  handlers['bPrev:click'](); expect(getCurrentWeekStr()).toBe('2026-10-05');
  for (let i = 0; i < 40; i++) handlers['bPrev:click']();
  expect(getCurrentWeekStr()).toBe('2025-12-29');
  for (let i = 0; i < 40; i++) handlers['bNext:click']();
  expect(getCurrentWeekStr()).toBe('2026-10-05'); expect(store.weekStatus).toBe('loaded');
  for (let i = 0; i < 4; i++) handlers['bNext:click']();
  expect(getCurrentWeekStr()).toBe('2026-11-02');
  for (let i = 0; i < 4; i++) handlers['bPrev:click']();
  expect(nodes.wLabel.textContent).toBe('05/10 - 11/10');
  expect(JSON.stringify(store.weeks)).toBe(original); expect(set).not.toHaveBeenCalled();
});
it('derives an unselected offset key and preserves selection through an anchor snapshot', () => {
  store.selectedWeek = null; store.wo = 4;
  expect(getCurrentWeekStr()).toBe('2026-11-02');
  store.wo = -28; expect(getCurrentWeekStr()).toBe('2026-03-23');
  handlers['datePicker:change']({ target: { value: '2026-10-11' } });
  snapshot.baseDate = '2026-03-23';
  onValue.mock.calls[0][1]({ val: () => structuredClone(snapshot) });
  expect(getCurrentWeekStr()).toBe('2026-10-05'); expect(store.wo).toBe(28);
  loadSelectedWeek(); render(); expect(nodes.wLabel.textContent).toBe('05/10 - 11/10');
  expect(set).not.toHaveBeenCalled();
});

it('limits directional motion to previous/next after rendering the selected week', () => {
  handlers['bNext:click']();
  expect(animate).toHaveBeenCalledTimes(1);
  expect(getCurrentWeekStr()).toBe('2026-10-12');
  handlers['bPrev:click']();
  expect(animate).toHaveBeenCalledTimes(2);
  handlers['datePicker:change']({ target: { value: '2026-10-19' } });
  expect(animate).toHaveBeenCalledTimes(2);
  expect(getCurrentWeekStr()).toBe('2026-10-19');
  expect(set).not.toHaveBeenCalled();
});
