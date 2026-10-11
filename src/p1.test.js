import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('./services/firebase.js', () => ({ db: {}, auth: {}, ref: vi.fn(), onValue: vi.fn(), set: vi.fn(() => Promise.resolve()), onAuthStateChanged: vi.fn(), signOut: vi.fn(), signInWithEmailAndPassword: vi.fn() }));
vi.mock('./ui/layout.js', () => ({ render: vi.fn() }));
vi.mock('./ui/components/log.js', () => ({ log: vi.fn(), renderLog: vi.fn() }));
import { store, syncState, saveState, loadSelectedWeek, getCurrentWeekStr, ensureRosterHistory } from './state/store.js';
import { setupEvents } from './controllers/events.js';
import { set, onValue } from './services/firebase.js';
import { DEFAULT_EMPLOYEES } from './config/employees.js';
import { DEFAULT_SHIFTS } from './config/shifts.js';
import { buildWeek } from './domain/schedule.js';
import { openCellEditor, selectShiftForCell, toggleCellBreak, updateCellBreak, confirmCellEdit } from './ui/modals/cellEditor.js';
import { closeModal } from './ui/modals/modal.js';
import { saveShiftEdit, openSingleShiftEditor } from './ui/modals/shiftEditor.js';
import { saveEmployeeEdit, deleteEmployee, openEmployeeEdit, confirmAddEmployee } from './ui/modals/empEditor.js';
import { log, renderLog } from './ui/components/log.js';
import { render } from './ui/layout.js';
let nodes, listeners;
const key = '2026-05-11';
const snapshot = () => structuredClone({ EMPLOYEES: store.EMPLOYEES, SH: store.SH, weeks: store.weeks, baseDate: store.baseDate, logEntries: store.logEntries });
const deliver = value => onValue.mock.calls[0][1]({ val: () => value });
beforeEach(() => {
  vi.clearAllMocks();
  render.mockReset(); renderLog.mockReset();
  set.mockImplementation(() => Promise.resolve());
  nodes = {}; listeners = {};
  vi.stubGlobal('document', { getElementById: id => nodes[id] ||= { value: '', style: {}, addEventListener: (event, fn) => { listeners[id + ':' + event] = fn; } }, querySelectorAll: () => [], querySelector: () => null });
  vi.stubGlobal('window', { _renderUI: vi.fn() });
  vi.stubGlobal('localStorage', { getItem: vi.fn(() => null), setItem: vi.fn() });
  Object.assign(store, { EMPLOYEES: structuredClone(DEFAULT_EMPLOYEES), SH: structuredClone(DEFAULT_SHIFTS), baseDate: key, customCounter: 0, selectedWeek: null, wo: 0, weeks: {}, edited: [], currentEdit: null, activeEditor: null, editorInvalidated: false, isAdmin: true, weekStatus: 'persisted', snapshotSource: 'loading', persistenceStatus: 'loading', pendingWrite: null, writeError: null, logEntries: [] });
  store.schedule = buildWeek(0);
  store.edited = store.schedule.map(row => row.map(() => false));
  store.weeks[key] = { schedule: structuredClone(store.schedule), edited: structuredClone(store.edited) };
  store.weekRosters = {}; store.employeeCounter = 0; store.scheduleRoster = null;
  ensureRosterHistory();
  store.currentDates = Array.from({ length: 7 }, () => ({ str: '11/05' }));
});
it('creates a missing week only through the admin action using active catalogs', () => {
  store.EMPLOYEES[0].name = 'Active employee';
  store.SH.M.name = 'Active shift';
  const catalogs = structuredClone({ employees: store.EMPLOYEES, shifts: store.SH });
  setupEvents(); listeners['bNext:click']();
  expect(set).not.toHaveBeenCalled();
  expect(store.schedule).toEqual([]);
  expect(listeners['bCreateWeek:click']).toBeTypeOf('function');
  listeners['bCreateWeek:click']();
  expect(store.schedule).toEqual(buildWeek(1));
  expect(store.weeks['2026-05-18'].schedule).toEqual(store.schedule);
  expect({ employees: store.EMPLOYEES, shifts: store.SH }).toEqual(catalogs);
  expect(set).toHaveBeenCalledTimes(1);
  listeners['bCreateWeek:click']();
  expect(set).toHaveBeenCalledTimes(1);
});
it('does not allow readers to create a missing week', () => {
  store.isAdmin = false;
  setupEvents(); listeners['bNext:click']();
  expect(listeners['bCreateWeek:click']).toBeTypeOf('function');
  listeners['bCreateWeek:click']();
  expect(store.schedule).toEqual([]);
  expect(set).not.toHaveBeenCalled();
});
it('preserves navigation and date-picker selection through unrelated anchor snapshots', () => {
  syncState(); setupEvents(); listeners['bNext:click']();
  const remote = snapshot(); remote.baseDate = '2026-05-04';
  deliver(remote);
  expect(getCurrentWeekStr()).toBe('2026-05-18');
  expect(store.schedule).toEqual([]);
  listeners['datePicker:change']({ target: { value: '2026-06-03' } });
  deliver(remote);
  expect(getCurrentWeekStr()).toBe('2026-06-01');
  expect(set).not.toHaveBeenCalled();
});
it('keeps optimistic listener delivery pending until the write acknowledges', async () => {
  let acknowledge;
  set.mockImplementation(() => new Promise(resolve => { acknowledge = resolve; }));
  syncState(); const completion = saveState(); deliver(snapshot());
  expect(store.persistenceStatus).toBe('pending');
  expect(store.snapshotSource).not.toBe('remote');
  acknowledge(); await completion;
  expect(store.persistenceStatus).toBe('persisted');
});
it('retains failed provenance after listener rollback and a later unrelated delivery', async () => {
  let fail;
  set.mockImplementation(() => new Promise((_, reject) => { fail = reject; }));
  syncState(); const completion = saveState(); deliver(snapshot());
  fail(new Error('Permission denied')); await completion;
  deliver(snapshot());
  expect(store.persistenceStatus).toBe('failed');
  expect(store.writeError).toContain('Permission denied');
});
it.each([null, { id: 'M', start: 9, end: 17 }, { ...DEFAULT_SHIFTS.M, end: Infinity }, { ...DEFAULT_SHIFTS.M, defaultBs: 17 }])('rejects a present but unusable referenced shift %j', definition => {
  // Dimensions and references are otherwise valid; M is actually referenced.
  store.schedule = DEFAULT_EMPLOYEES.map(() => Array.from({ length: 7 }, () => ({ id: 'M', bs: 13, bd: 1 })));
  store.weeks[key].schedule = structuredClone(store.schedule);
  store.SH.M = definition;
  loadSelectedWeek();
  expect(store.weekStatus).toBe('invalid');
  expect(store.schedule).toEqual([]);
  expect(() => saveState()).toThrow();
  expect(set).not.toHaveBeenCalled();
});
it('blocks referenced shift edits before mutating history', () => {
  const before = snapshot();
  const values = { edStart: '9', edEnd: '18', edDefBs: '13', edDefBd: '1', edAbbr: 'New', edName: 'Changed' };
  for (const [id, value] of Object.entries(values)) document.getElementById(id).value = value;
  saveShiftEdit('M');
  expect(snapshot()).toEqual(before);
  expect(log).toHaveBeenCalledWith(expect.stringMatching(/bloquead|guardad/i), 'err');
  expect(set).not.toHaveBeenCalled();
});
it.each(['rename', 'freeDay', 'delete'])('preserves history during employee %s', operation => {
  const before = snapshot();
  document.getElementById('edEmpName').value = operation === 'rename' ? 'Changed' : store.EMPLOYEES[0].name;
  document.getElementById('edEmpDay').value = operation === 'freeDay' ? '1' : '0';
  if (operation === 'delete') deleteEmployee(0); else saveEmployeeEdit(0);
  expect(store.weeks).toEqual(before.weeks);
  expect(store.weekRosters[key][0].name).toBe(before.EMPLOYEES[0].name);
  if (operation === 'delete') {
    expect(set).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/bloquead|guardad/i), 'err');
  } else expect(set).toHaveBeenCalledTimes(1);
});
it.each(['shift', 'toggle', 'break'])('discards staged %s edits, including a later unrelated save', operation => {
  store.schedule[0][1] = { id: 'M', bs: 13, bd: 1 };
  store.weeks[key].schedule = structuredClone(store.schedule);
  const before = structuredClone(store.schedule);
  openCellEditor(0, 1);
  if (operation === 'shift') selectShiftForCell('OFF');
  else if (operation === 'toggle') { document.getElementById('cellBrk').checked = false; toggleCellBreak(); }
  else { document.getElementById('cellBs').value = '14'; document.getElementById('cellBd').value = '0.5'; updateCellBreak(); }
  expect(store.schedule).toEqual(before);
  closeModal(); store.customCounter++; saveState();
  expect(set.mock.calls[0][1].weeks[key].schedule).toEqual(before);
});
it('applies staged edits once and copies schedule and edited arrays', () => {
  openCellEditor(0, 1);
  const options = () => [...nodes.modalBody.innerHTML.matchAll(/<button class="shift-opt ([^"]*)" aria-pressed="(true|false)"/g)];
  expect(options().filter(option => option[2] === 'true')).toHaveLength(1);
  expect(options().find(option => option[2] === 'true')[1]).toContain('selected');
  const original = store.schedule[0][1].id;
  selectShiftForCell('OFF');
  expect(options().filter(option => option[2] === 'true')).toHaveLength(1);
  expect(options().find(option => option[2] === 'true')[1]).toContain(store.SH.OFF.cls);
  expect(store.currentEdit.draft.id).toBe('OFF');
  expect(store.schedule[0][1].id).toBe(original);
  confirmCellEdit(); confirmCellEdit();
  expect(set).toHaveBeenCalledTimes(1);
  expect(store.schedule[0][1].id).toBe('OFF');
  const saved = structuredClone(store.weeks[key]);
  store.schedule[0][1].id = 'M'; store.edited[0][1] = false; store.schedule.push([]);
  expect(store.weeks[key]).toEqual(saved);
  expect(set.mock.calls[0][1].weeks[key]).toEqual(saved);
});
it.each(['identical', 'logs'])('preserves a staged cell edit through %s snapshots', kind => {
  syncState(); openCellEditor(0, 1); selectShiftForCell('OFF');
  const value = snapshot(); if (kind === 'logs') value.logEntries = [{ msg: 'Remote log' }];
  deliver(value);
  expect(store.currentEdit).not.toBeNull();
  expect(store.editorInvalidated).toBe(false);
  confirmCellEdit();
  expect(store.schedule[0][1].id).toBe('OFF');
});
it.each(['cell', 'employee', 'shift'])('invalidates only relevant changes for an active %s editor', kind => {
  syncState();
  if (kind === 'cell') openCellEditor(0, 1);
  else if (kind === 'employee') openEmployeeEdit(0);
  else openSingleShiftEditor('M');
  deliver(snapshot()); expect(store.editorInvalidated).toBe(false);
  const changed = snapshot();
  if (kind === 'cell') changed.weeks[key].schedule[0][1] = { id: 'OFF', bs: null, bd: 1 };
  else if (kind === 'employee') changed.EMPLOYEES[0].name = 'Remote';
  else changed.SH.M.name = 'Remote';
  deliver(changed); expect(store.editorInvalidated).toBe(true);
});

it('preserves an editor through updates to a different cell and historical week', () => {
  syncState(); openCellEditor(0, 1);
  const changed = snapshot();
  changed.weeks[key].schedule[1][1] = { id: 'OFF', bs: null, bd: 1 };
  changed.weeks['2026-05-04'] = structuredClone(changed.weeks[key]);
  deliver(changed);
  expect(store.currentEdit).not.toBeNull();
  expect(store.editorInvalidated).toBe(false);
});
it('discards a draft when navigation changes the selected week', () => {
  openCellEditor(0, 1); selectShiftForCell('OFF'); setupEvents(); listeners['bNext:click']();
  expect(store.currentEdit).toBeNull();
  expect(store.editorInvalidated).toBe(true);
  expect(store.weeks[key].schedule[0][1].id).not.toBe('OFF');
});
it('allows safe employee changes with no persisted history', () => {
  store.weeks = {};
  document.getElementById('edEmpName').value = 'Safe rename';
  document.getElementById('edEmpDay').value = '1';
  saveEmployeeEdit(0);
  expect(store.EMPLOYEES[0]).toMatchObject({ name: 'Safe rename', freeDay: 1 });
  expect(set).toHaveBeenCalledTimes(1);
});
it('allows safe unused shift edits and rejects out-of-bounds definitions', () => {
  store.SH.X1 = { ...store.SH.M, id: 'X1', builtin: false };
  const values = { edStart: '9', edEnd: '18', edDefBs: '13', edDefBd: '0.5', edAbbr: 'Safe', edName: 'Unused' };
  for (const [id, value] of Object.entries(values)) document.getElementById(id).value = value;
  saveShiftEdit('X1');
  expect(store.SH.X1.name).toBe('Unused');
  expect(set).toHaveBeenCalledTimes(1);
  document.getElementById('edEnd').value = '25'; saveShiftEdit('X1');
  expect(store.SH.X1.end).toBe(18);
  expect(set).toHaveBeenCalledTimes(1);
});
it('keeps failed state when set throws synchronously', async () => {
  set.mockImplementation(() => { throw new Error('Write unavailable'); });
  await saveState();
  expect(store.persistenceStatus).toBe('failed');
  expect(store.writeError).toContain('Write unavailable');
});
it('does not mistake a stale write acknowledgement for the latest write', async () => {
  let first, last;
  set.mockImplementationOnce(() => new Promise(resolve => { first = resolve; }))
    .mockImplementationOnce(() => new Promise(resolve => { last = resolve; }));
  const a = saveState(); store.customCounter++; const b = saveState();
  first(); await a; expect(store.persistenceStatus).toBe('pending');
  last(); await b; expect(store.persistenceStatus).toBe('persisted');
});
it('continues persistence if browser cache storage is unavailable', async () => {
  localStorage.setItem.mockImplementation(() => { throw new Error('Quota exceeded'); });
  await saveState();
  expect(set).toHaveBeenCalledTimes(1);
  expect(store.persistenceStatus).toBe('persisted');
});
it('blocks persisting a malformed historical week even when all keys exist', () => {
  store.weeks['2026-05-04'] = { schedule: [[{ id: 'M', bs: 13, bd: 1 }]] };
  expect(() => saveState()).toThrow();
  expect(set).not.toHaveBeenCalled();
});

it('renders the selected absolute week and remote log once through complete navigation and snapshot interaction', async () => {
  const realLayout = await vi.importActual('./ui/layout.js');
  const realLog = await vi.importActual('./ui/components/log.js');
  render.mockImplementation(realLayout.render);
  renderLog.mockImplementation(realLog.renderLog);
  window._renderUI = render;
  syncState(); setupEvents(); deliver(snapshot()); listeners['bNext:click']();
  expect(nodes.datePicker.value).toBe('2026-05-18');
  expect(nodes.tContainer.textContent).toContain('Sin horario');
  const changed = snapshot(); changed.baseDate = '2026-05-04';
  changed.logEntries = [{ ts: 'remote', msg: 'Remote update', type: 'ok' }];
  render.mockClear(); renderLog.mockClear(); deliver(changed);
  expect(nodes.datePicker.value).toBe('2026-05-18');
  expect(nodes.wLabel.textContent).toBe('18/05 - 24/05');
  expect(nodes.logPanel.innerHTML).toContain('Remote update');
  expect(render).toHaveBeenCalledTimes(1);
  expect(renderLog).toHaveBeenCalledTimes(1);
  expect(set).not.toHaveBeenCalled();
});
it('ends the local proposal state on acknowledged creation even without a listener echo', async () => {
  store.weekStatus = 'proposal';
  await saveState();
  expect(store.persistenceStatus).toBe('persisted');
  expect(store.weekStatus).not.toBe('proposal');
});


it('adds to the active roster without changing any persisted historical cells or row mapping', async () => {
  // Use different week data and omitted nulls to detect rewriting as well as appending.
  store.weeks['2026-05-04'] = structuredClone(store.weeks[key]);
  store.weeks[key].schedule[0][0] = { id: 'OFF' };
  store.weeks['2026-05-04'].schedule[1][1] = { id: 'OFF' };
  const history = structuredClone(store.weeks);
  const mapping = store.EMPLOYEES.map(e => e.name);
  const current = structuredClone(store.schedule);
  document.getElementById('newEmpName').value = 'Future employee';
  document.getElementById('newEmpDay').value = '2';
  confirmAddEmployee();
  expect(store.weeks).toEqual(history);
  expect(store.schedule).toEqual(current);
  expect(store.EMPLOYEES.slice(0, mapping.length).map(e => e.name)).toEqual(mapping);
  expect(store.EMPLOYEES.at(-1)).toMatchObject({ name: 'Future employee', freeDay: 2 });
  expect(set.mock.calls[0][1].weeks).toEqual(history);
  expect(set.mock.calls[0][1].EMPLOYEES.at(-1).name).toBe('Future employee');
  await Promise.resolve();
  syncState(); deliver(snapshot());
  expect(store.weekStatus).not.toBe('invalid');
  expect(store.schedule).toHaveLength(mapping.length);
  expect(store.weeks).toEqual(history);
  const realLayout = await vi.importActual('./ui/layout.js');
  const realLog = await vi.importActual('./ui/components/log.js');
  renderLog.mockImplementation(realLog.renderLog);
  for (const view of ['person', 'day', 'hours', 'cover']) {
    store.view = view;
    expect(() => realLayout.render()).not.toThrow();
    if (view === 'person' || view === 'hours') {
      expect(nodes.tContainer.innerHTML).not.toContain('Future employee');
      for (const name of mapping) expect(nodes.tContainer.innerHTML).toContain(name);
    }
  }
  expect(nodes.metricsSide.innerHTML).toContain('/6 personas');
  setupEvents(); listeners['bNext:click']();
  expect(store.schedule).toEqual([]);
  listeners['bCreateWeek:click']();
  expect(store.schedule).toHaveLength(mapping.length + 1);
  expect(store.schedule.at(-1)[2].id).toBe('OFF');
  expect(store.weeks[key]).toEqual(history[key]);
  expect(store.weeks['2026-05-04']).toEqual(history['2026-05-04']);
  expect(set.mock.calls.at(-1)[1].weeks[key]).toEqual(history[key]);
  expect(set.mock.calls.at(-1)[1].weeks['2026-05-04']).toEqual(history['2026-05-04']);
});

it.each(['rename', 'freeDay', 'delete'])('preserves historical attribution during employee %s after roster expansion', operation => {
  document.getElementById('newEmpName').value = 'Future employee';
  document.getElementById('newEmpDay').value = '2';
  confirmAddEmployee();
  const before = snapshot();
  set.mockClear(); log.mockClear();
  document.getElementById('edEmpName').value = operation === 'rename' ? 'Changed' : store.EMPLOYEES[0].name;
  document.getElementById('edEmpDay').value = operation === 'freeDay' ? '1' : '0';
  if (operation === 'delete') deleteEmployee(0); else saveEmployeeEdit(0);
  expect(store.weeks).toEqual(before.weeks);
  expect(store.weekRosters[key][0].name).toBe(before.EMPLOYEES[0].name);
  if (operation === 'delete') {
    expect(set).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/bloquead|guardad/i), 'err');
  } else expect(set).toHaveBeenCalledTimes(1);
});

it('exposes one draft selection as it moves across the available shifts', () => {
  openCellEditor(0, 1);
  const original = structuredClone(store.schedule);
  for (const id of Object.keys(store.SH)) {
    selectShiftForCell(id);
    const selected = [...nodes.modalBody.innerHTML.matchAll(/<button class="shift-opt ([^"]*)" aria-pressed="true"[^>]*>([\s\S]*?)<\/button>/g)];
    expect(selected).toHaveLength(1);
    expect(selected[0][1]).toContain('selected');
    expect(selected[0][1]).toContain(store.SH[id].cls);
    expect(store.currentEdit.draft.id).toBe(id);
  }
  expect(store.schedule).toEqual(original);
  expect(set).not.toHaveBeenCalled();
});
