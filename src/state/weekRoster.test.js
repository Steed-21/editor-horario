import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const firebase = vi.hoisted(() => ({ db: {}, ref: vi.fn((_db, path) => path), onValue: vi.fn(), set: vi.fn() }));
vi.mock('../services/firebase.js', () => firebase);
let state, source, delivery;
const past = '2026-10-05', current = '2026-10-12', future = '2026-10-19';
const copy = value => structuredClone(value);
const bytes = value => JSON.stringify(value);
beforeEach(async () => {
  vi.resetModules(); vi.clearAllMocks(); vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 14, 12));
  vi.stubGlobal('window', { _renderUI: vi.fn() });
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });
  state = await import('./store.js');
  const { DEFAULT_SHIFTS } = await import('../config/shifts.js');
  const employees = ['a', 'b', 'c', 'd'].map((id, freeDay) => ({ id, name: `Synthetic ${id}`, freeDay, active: id !== 'd' }));
  const week = { schedule: [0, 1].map(i => Array.from({ length: 7 }, (_, day) => ({ id: day === i ? 'OFF' : 'S', bs: null, bd: 1 }))),
    edited: [Array(7).fill(false), Array(7).fill(true)] };
  source = { schemaVersion: 2, EMPLOYEES: employees, SH: copy(DEFAULT_SHIFTS), baseDate: current,
    weeks: Object.fromEntries([past, current, future].map(key => [key, copy(week)])),
    weekRosters: Object.fromEntries([past, current, future].map(key => [key, copy(employees.slice(0, 2))])), logEntries: [] };
  state.store.selectedWeek = current; state.syncState();
  delivery = snapshot => firebase.onValue.mock.calls[0][1]({ val: () => copy(snapshot) });
  delivery(source); state.store.isAdmin = true;
  firebase.set.mockImplementation(() => Promise.resolve());
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
function select(key) { state.store.selectedWeek = key; state.loadSelectedWeek(); }
function stable() { return bytes({ weeks: state.store.weeks, rosters: state.store.weekRosters, employees: state.store.EMPLOYEES }); }
async function reject(request) {
  const before = stable();
  const result = await state.mutateWeekRoster(request);
  expect(result.ok).toBe(false); expect(result.error).toBeTruthy();
  expect(firebase.set).not.toHaveBeenCalled(); expect(stable()).toBe(before);
}
it.each(['add', 'replace', 'remove'])('blocks %s for a past week without writing', async operation => {
  select(past); await reject({ operation, candidateId: 'c', targetId: 'a' });
});
it.each(['replace', 'remove'])('blocks unconfirmed current-week %s', async operation => {
  await reject({ operation, candidateId: 'c', targetId: 'a' });
});
it.each([current, future])('appends OFF and false rows to %s without changing existing rows or other weeks', async key => {
  select(key); const before = copy(source);
  const result = await state.mutateWeekRoster({ operation: 'add', candidateId: 'c' });
  expect(result.ok).toBe(true);
  const payload = firebase.set.mock.calls[0][1];
  expect(payload.weekRosters[key]).toEqual([...before.weekRosters[key], before.EMPLOYEES[2]]);
  expect(payload.weeks[key].schedule.slice(0, 2)).toEqual(before.weeks[key].schedule);
  expect(payload.weeks[key].edited.slice(0, 2)).toEqual(before.weeks[key].edited);
  expect(payload.weeks[key].schedule[2]).toEqual(Array.from({ length: 7 }, () => ({ id: 'OFF', bs: null, bd: 1 })));
  expect(payload.weeks[key].edited[2]).toEqual(Array(7).fill(false));
  for (const other of [past, current, future].filter(other => other !== key)) {
    expect(bytes(payload.weeks[other])).toBe(bytes(before.weeks[other]));
    expect(bytes(payload.weekRosters[other])).toBe(bytes(before.weekRosters[other]));
  }
  expect(payload.EMPLOYEES).toEqual(before.EMPLOYEES);
  expect(state.store.weekStatus).toBe('proposal');
  delivery(payload); expect(state.getWeekEmployees()[2].id).toBe('c');
  expect(state.store.weekStatus).toBe('proposal');
  await state.saveState(); expect(state.store.persistenceStatus).toBe('persisted');
});
it('replaces only the future identity, preserving exact planned and edited rows', async () => {
  select(future); state.store.EMPLOYEES.reverse();
  const employees = copy(state.store.EMPLOYEES);
  expect((await state.mutateWeekRoster({ operation: 'replace', targetId: 'a', candidateId: 'c' })).ok).toBe(true);
  const payload = firebase.set.mock.calls[0][1];
  expect(payload.weekRosters[future].map(e => e.id)).toEqual(['c', 'b']);
  expect(bytes(payload.weeks[future].schedule)).toBe(bytes(source.weeks[future].schedule));
  expect(bytes(payload.weeks[future].edited)).toBe(bytes(source.weeks[future].edited));
  expect(payload.EMPLOYEES).toEqual(employees);
});
it('removes the matching future row and preserves remaining positional attribution', async () => {
  select(future);
  expect((await state.mutateWeekRoster({ operation: 'remove', targetId: 'a', confirmation: 'ELIMINAR' })).ok).toBe(true);
  expect(state.store.weekRosters[future]).toEqual([source.weekRosters[future][1]]);
  expect(state.store.weeks[future].schedule).toEqual([source.weeks[future].schedule[1]]);
  expect(state.store.weeks[future].edited).toEqual([source.weeks[future].edited[1]]);
  firebase.set.mockClear(); await reject({ operation: 'remove', targetId: 'b', confirmation: 'ELIMINAR' });
});
it.each(['d', 'a', 'unknown', ''])('rejects ineligible candidate %s', async candidateId => {
  await reject({ operation: 'add', candidateId });
});
it.each(['reader', 'pending', 'missing', 'invalid', 'legacy', 'roster', 'alignment', 'edited', 'cell', 'attribution', 'unsaved'])('fails closed for %s', async guard => {
  const s = state.store;
  if (guard === 'reader') s.isAdmin = false;
  if (guard === 'pending') s.pendingWrite = 22;
  if (guard === 'missing') delete s.weeks[current];
  if (guard === 'invalid' || guard === 'legacy') s.weekStatus = guard;
  if (guard === 'roster') s.weekRosters[current][0] = null;
  if (guard === 'alignment') s.weeks[current].schedule.pop();
  if (guard === 'edited') s.weeks[current].edited[0] = [false];
  if (guard === 'cell') s.weeks[current].schedule[0][0].id = 'MISSING';
  if (guard === 'attribution') s.weekRosters[current][0].attribution = 'legacy-observed';
  if (guard === 'unsaved') s.schedule[0][0].id = 'S';
  await reject({ operation: 'add', candidateId: 'c' });
});
it('awaits actual acknowledgement despite optimistic listener delivery', async () => {
  let resolve;
  firebase.set.mockImplementation(() => new Promise(done => { resolve = done; }));
  const operation = state.mutateWeekRoster({ operation: 'add', candidateId: 'c' });
  const payload = firebase.set.mock.calls[0][1]; delivery(payload);
  expect(state.store.persistenceStatus).toBe('pending');
  let complete = false; operation.then(() => { complete = true; });
  await Promise.resolve(); expect(complete).toBe(false);
  resolve(); expect((await operation).ok).toBe(true);
  expect(state.store.persistenceStatus).toBe('persisted');
  firebase.set.mockImplementation(() => Promise.resolve());
  await state.saveState(); expect(state.store.persistenceStatus).toBe('persisted');
});
it('restores before-state after rejected optimistic write and exposes failure without a success log', async () => {
  firebase.set.mockImplementation((_ref, payload) => { delivery(payload); return Promise.reject(new Error('Synthetic write failure')); });
  const before = stable();
  const result = await state.mutateWeekRoster({ operation: 'add', candidateId: 'c' });
  expect(result.ok).toBe(false); expect(stable()).toBe(before);
  expect(state.store.persistenceStatus).toBe('failed');
  expect(state.store.writeError).toContain('Synthetic write failure');
  expect(state.store.logEntries).toEqual([]);
  firebase.set.mockImplementation(() => Promise.resolve());
  await state.saveState(); expect(state.store.persistenceStatus).toBe('persisted');
});
it('keeps the generic historical guard after the authorized operation', async () => {
  await state.mutateWeekRoster({ operation: 'add', candidateId: 'c' });
  state.store.weekRosters[past][0].name = 'Unauthorized';
  expect(() => state.saveState({ saveSelectedWeek: false })).toThrow('historical attribution changed');
});
it('does not overwrite remote changes or a different session on write failure', async () => {
  let fail;
  firebase.set.mockImplementation(() => new Promise((_done, reject) => { fail = reject; }));
  const operation = state.mutateWeekRoster({ operation: 'add', candidateId: 'c' });
  const remote = copy(source); remote.weekRosters[current][0].name = 'Remote name'; delivery(remote);
  fail(new Error('Conflict')); expect((await operation).ok).toBe(false);
  expect(state.store.weekRosters[current][0].name).toBe('Remote name');
});
it('does not allow optimistic delivery to authorize a generic roster change', async () => {
  let resolve;
  firebase.set.mockImplementation((_ref, payload) => { delivery(payload); return new Promise(done => { resolve = done; }); });
  const operation = state.mutateWeekRoster({ operation: 'add', candidateId: 'c' });
  expect(() => state.saveState({ saveSelectedWeek: false })).toThrow('historical attribution changed');
  resolve(); expect((await operation).ok).toBe(true);
});
it('rejects a stale UI week key and an unknown target', async () => {
  await reject({ week: future, operation: 'add', candidateId: 'c' });
  select(future); await reject({ operation: 'replace', targetId: 'unknown', candidateId: 'c' });
});
it('does not roll back into a signed-out session', async () => {
  let fail;
  firebase.set.mockImplementation(() => new Promise((_done, reject) => { fail = reject; }));
  const operation = state.mutateWeekRoster({ operation: 'add', candidateId: 'c' });
  state.clearSessionState(); state.store.isAdmin = false;
  fail(new Error('Late failure')); expect((await operation).ok).toBe(false);
  expect(state.store.weeks).toEqual({}); expect(state.store.weekRosters).toEqual({});
});
it('keeps unrelated legacy records and reader-compatible payload paths unchanged', async () => {
  const legacy = copy(source); legacy.weeks[past].schedule[0][0].id = 'X11'; delivery(legacy);
  expect((await state.mutateWeekRoster({ operation: 'add', candidateId: 'c' })).ok).toBe(true);
  const payload = firebase.set.mock.calls[0][1];
  expect(bytes(payload.weeks[past])).toBe(bytes(legacy.weeks[past]));
  expect(payload.weeks[current].schedule.length).toBe(payload.weekRosters[current].length);
  select(past); expect(state.store.weekStatus).toBe('legacy');
});
it('rejects an actual unresolved legacy write target', async () => {
  const legacy = copy(source); legacy.weeks[current].schedule[0][0].id = 'X10'; delivery(legacy);
  await reject({ operation: 'add', candidateId: 'c' });
});
it('does not alias the catalog, planned rows or editor arrays after mutation', async () => {
  await state.mutateWeekRoster({ operation: 'add', candidateId: 'c' });
  state.store.schedule[2][0].id = 'S'; state.store.edited[2][0] = true;
  state.store.EMPLOYEES[2].name = 'Future default';
  expect(state.store.weeks[current].schedule[2][0].id).toBe('OFF');
  expect(state.store.weeks[current].edited[2][0]).toBe(false);
  expect(state.store.weekRosters[current][2].name).toBe('Synthetic c');
});
it('hydrates the resulting snapshot through the unchanged three reader paths', async () => {
  await state.mutateWeekRoster({ operation: 'add', candidateId: 'c' });
  const payload = copy(firebase.set.mock.calls[0][1]);
  firebase.onValue.mockClear(); state.store.isAdmin = false;
  const { syncReader } = await import('./readerSync.js'); const stop = syncReader();
  const paths = firebase.onValue.mock.calls.map(call => call[0]);
  expect(paths).toEqual(['horario_v5_state/SH', `horario_v5_state/weeks/${current}/schedule`, `horario_v5_state/weekRosters/${current}`]);
  const values = [payload.SH, payload.weeks[current].schedule, payload.weekRosters[current]];
  firebase.onValue.mock.calls.forEach((call, index) => call[1]({ val: () => copy(values[index]) }));
  expect(state.store.readerStatus).toBe('ready');
  expect(state.store.schedule).toEqual(payload.weeks[current].schedule);
  expect(state.getWeekEmployees().map(e => e.name)).toEqual(payload.weekRosters[current].map(e => e.name));
  expect(state.store.EMPLOYEES).toEqual([]); expect(state.store.edited.flat().every(value => value === false)).toBe(true);
  stop();
});
it('reports a relevant remote conflict even if the write promise resolves', async () => {
  let resolve;
  firebase.set.mockImplementation(() => new Promise(done => { resolve = done; }));
  const operation = state.mutateWeekRoster({ operation: 'add', candidateId: 'c' });
  const remote = copy(source); remote.weekRosters[current][0].name = 'Remote identity'; delivery(remote);
  resolve(); const result = await operation;
  expect(result.ok).toBe(false); expect(result.error).toContain('Conflicto');
  expect(state.store.persistenceStatus).toBe('failed');
  expect(state.store.weekRosters[current][0].name).toBe('Remote identity');
});
it('allows explicit current replacement without changing schedule geometry', async () => {
  expect((await state.mutateWeekRoster({ operation: 'replace', targetId: 'a', candidateId: 'c', confirmed: true })).ok).toBe(true);
  expect(state.store.weekRosters[current].map(e => e.id)).toEqual(['c', 'b']);
  expect(bytes(state.store.weeks[current].schedule)).toBe(bytes(source.weeks[current].schedule));
  expect(bytes(state.store.weeks[current].edited)).toBe(bytes(source.weeks[current].edited));
});
it('allows typed-confirmed current removal and records stable audit identity', async () => {
  expect((await state.mutateWeekRoster({ operation: 'remove', targetId: 'a', confirmation: 'ELIMINAR' })).ok).toBe(true);
  expect(state.store.weekRosters[current].map(e => e.id)).toEqual(['b']);
  expect(state.store.weeks[current].schedule).toEqual([source.weeks[current].schedule[1]]);
  expect(state.store.logEntries[0]).toMatchObject({ employeeId: 'a', employeeName: 'Synthetic a', week: current, operation: 'remove' });
  expect(bytes(state.store.logEntries)).not.toContain('ELIMINAR');
});
it.each(['', 'eliminar', ' ELIMINAR', 'ELIMINAR '])('rejects weekly removal confirmation %s', async confirmation => {
  select(future); await reject({ operation: 'remove', targetId: 'a', confirmation });
});
it('hard deletes historical identity only from the catalog after confirmation', async () => {
  const before = bytes({ weeks: state.store.weeks, rosters: state.store.weekRosters });
  expect(state.employeeHasHistory(0)).toBe(true);
  expect((await state.deleteCatalogEmployee({ employeeId: 'a', confirmation: 'ELIMINAR' })).ok).toBe(true);
  expect(state.store.EMPLOYEES.map(e => e.id)).toEqual(['b', 'c', 'd']);
  expect(bytes({ weeks: state.store.weeks, rosters: state.store.weekRosters })).toBe(before);
  expect(state.getWeekEmployees()[0].id).toBe('a');
  expect(state.getActiveEmployees().map(e => e.id)).not.toContain('a');
  expect(bytes(firebase.set.mock.calls[0][1].weeks)).toBe(bytes(source.weeks));
  expect(bytes(firebase.set.mock.calls[0][1].weekRosters)).toBe(bytes(source.weekRosters));
});
it.each(['confirmation', 'reader', 'pending', 'unknown', 'last', 'malformed'])('blocks unsafe catalog deletion: %s', async guard => {
  let confirmation = 'ELIMINAR', employeeId = 'a';
  if (guard === 'confirmation') confirmation = 'ELIMINAR ';
  if (guard === 'reader') state.store.isAdmin = false;
  if (guard === 'pending') state.store.pendingWrite = 1;
  if (guard === 'unknown') employeeId = 'unknown';
  if (guard === 'last') state.store.EMPLOYEES = state.store.EMPLOYEES.slice(0, 1);
  if (guard === 'malformed') state.store.weekRosters[current] = null;
  const before = stable();
  expect((await state.deleteCatalogEmployee({ employeeId, confirmation })).ok).toBe(false);
  expect(stable()).toBe(before); expect(firebase.set).not.toHaveBeenCalled();
});
it('restores exact catalog order after rejected optimistic deletion with no success log', async () => {
  const before = stable();
  firebase.set.mockImplementation((_ref, payload) => { delivery(payload); return Promise.reject(new Error('Delete failed')); });
  expect((await state.deleteCatalogEmployee({ employeeId: 'a', confirmation: 'ELIMINAR' })).ok).toBe(false);
  expect(stable()).toBe(before); expect(state.store.persistenceStatus).toBe('failed');
  expect(state.store.logEntries).toEqual([]);
});
it('does not replace a newer remote catalog on deletion failure', async () => {
  let fail;
  firebase.set.mockImplementation(() => new Promise((_done, reject) => { fail = reject; }));
  const operation = state.deleteCatalogEmployee({ employeeId: 'a', confirmation: 'ELIMINAR' });
  const remote = copy(source); remote.EMPLOYEES[0].name = 'Remote catalog name'; delivery(remote);
  fail(new Error('Delete conflict')); expect((await operation).ok).toBe(false);
  expect(state.store.EMPLOYEES[0].name).toBe('Remote catalog name');
});
it('keeps the newly added weekly cell editable through the unchanged cell editor', async () => {
  await state.mutateWeekRoster({ operation: 'add', candidateId: 'c' });
  const nodes = {};
  vi.stubGlobal('document', { getElementById: id => nodes[id] ||= { style: {}, innerHTML: '' }, querySelectorAll: () => [], querySelector: () => null });
  state.store.currentDates = Array.from({ length: 7 }, () => ({ str: '14/10' }));
  const editor = await import('../ui/modals/cellEditor.js');
  editor.openCellEditor(2, 0); editor.selectShiftForCell('S'); editor.confirmCellEdit();
  await Promise.resolve();
  expect(state.store.schedule[2][0].id).toBe('S'); expect(state.store.edited[2][0]).toBe(true);
  expect(firebase.set.mock.calls.at(-1)[1].weeks[current].schedule[2][0].id).toBe('S');
  expect(state.store.weekRosters[current][2].id).toBe('c');
});
it('does not expose a weekly removal audit before acknowledgement or retain it after failure', async () => {
  let fail;
  firebase.set.mockImplementation((_ref, payload) => { delivery(payload); return new Promise((_done, reject) => { fail = reject; }); });
  const operation = state.mutateWeekRoster({ operation: 'remove', targetId: 'a', confirmation: 'ELIMINAR' });
  expect(state.store.persistenceStatus).toBe('pending'); expect(state.store.logEntries).toEqual([]);
  expect(firebase.set.mock.calls[0][1].logEntries[0].employeeId).toBe('a');
  fail(new Error('Remove failed')); expect((await operation).ok).toBe(false);
  expect(state.store.logEntries).toEqual([]);
  expect(state.store.weekRosters[current]).toEqual(source.weekRosters[current]);
});
it('excludes a deleted historical catalog identity from actual future generation', async () => {
  const { DEFAULT_EMPLOYEES } = await import('../config/employees.js');
  const { buildWeek } = await import('../domain/schedule.js');
  const employees = DEFAULT_EMPLOYEES.map((e, i) => ({ id: `synthetic-${i}`, name: `Synthetic ${i}`, active: true, freeDay: e.freeDay }));
  const removed = { id: 'extra', name: 'Synthetic extra', active: true, freeDay: 0 };
  const fixture = copy(source); fixture.EMPLOYEES = [...employees, removed];
  fixture.weekRosters[current] = copy(fixture.EMPLOYEES);
  fixture.weeks[current] = { schedule: fixture.EMPLOYEES.map(() => Array.from({length:7},()=>({id:'OFF',bs:null,bd:1}))), edited: fixture.EMPLOYEES.map(()=>Array(7).fill(false)) };
  delivery(fixture);
  expect((await state.deleteCatalogEmployee({ employeeId: 'extra', confirmation: 'ELIMINAR' })).ok).toBe(true);
  const active = state.getActiveEmployees(); const schedule = buildWeek(1, active, state.store.SH);
  expect(schedule).toHaveLength(6); expect(active.map(e=>e.id)).not.toContain('extra');
  expect(state.store.weekRosters[current].at(-1).id).toBe('extra');
});
