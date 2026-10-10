import { beforeEach, expect, it, vi } from 'vitest';
const firebase = vi.hoisted(() => ({ db: {}, auth: {}, ref: vi.fn(), onValue: vi.fn(), set: vi.fn(() => Promise.resolve()), onAuthStateChanged: vi.fn(), signOut: vi.fn(), signInWithEmailAndPassword: vi.fn() }));
vi.mock('../services/firebase.js', () => firebase);
vi.mock('../ui/layout.js', () => ({ render: vi.fn() }));
let state, cells, shifts, events, nodes, handlers, original;
const historical = '2027-01-04';
const future = '2027-01-18';
beforeEach(async () => {
  vi.resetModules(); vi.clearAllMocks();
  firebase.set.mockImplementation(() => Promise.resolve());
  firebase.onValue.mockImplementation(() => vi.fn());
  nodes = {}; handlers = {};
  vi.stubGlobal('window', { _renderUI: vi.fn() });
  vi.stubGlobal('localStorage', { getItem: vi.fn(() => null), setItem: vi.fn() });
  vi.stubGlobal('document', { getElementById: id => nodes[id] ||= { style: {}, value: '', innerHTML: '', textContent: '', addEventListener: (event, fn) => { handlers[id + ':' + event] = fn; } }, querySelector: () => null, querySelectorAll: () => [] });
  state = await import('./store.js');
  cells = await import('../ui/modals/cellEditor.js');
  shifts = await import('../ui/modals/shiftEditor.js');
  events = await import('../controllers/events.js');
  const { DEFAULT_SHIFTS } = await import('../config/shifts.js');
  const employees = [0, 1, 1, 4, 3, 2].map((freeDay, i) => ({ name: `Synthetic employee ${i + 1}`, freeDay }));
  const makeWeek = () => ({ schedule: employees.map(() => Array.from({ length: 7 }, () => ({ id: 'OFF' }))), edited: employees.map(() => Array(7).fill(false)) });
  const weeks = { [historical]: makeWeek(), '2027-01-11': makeWeek() };
  weeks[historical].schedule[1][4] = { id: 'X11', bs: null, bd: 1 };
  weeks[historical].schedule[1][5] = { id: 'X11' };
  weeks[historical].schedule[0][0] = { id: 'M', bs: 13, bd: 1 };
  weeks['2027-01-11'].schedule[1][4] = { id: 'X10' };
  weeks['2027-01-11'].schedule[3][5] = { id: 'X10' };
  original = JSON.stringify(weeks);
  Object.assign(state.store, { baseDate: historical, selectedWeek: historical, wo: 0 });
  state.syncState();
  firebase.onValue.mock.calls[0][1]({ val: () => ({ EMPLOYEES: employees, SH: structuredClone(DEFAULT_SHIFTS), baseDate: historical, weeks, logEntries: [] }) });
  state.store.isAdmin = true;
});
it('identifies received unresolved history as legacy without altering it', () => {
  expect(state.store.weekStatus).toBe('legacy');
  expect(state.store.schedule).toEqual([]);
  expect(JSON.stringify(state.store.weeks)).toBe(original);
  expect(state.store.SH.X10).toBeUndefined();
  expect(state.store.SH.X11).toBeUndefined();
});
it('explicitly creates and persists a valid future week without rewriting legacy records', async () => {
  events.setupEvents();
  handlers['datePicker:change']({ target: { value: future } });
  expect(firebase.set).not.toHaveBeenCalled();
  handlers['bCreateWeek:click']();
  expect(firebase.set).toHaveBeenCalledTimes(1);
  const written = firebase.set.mock.calls[0][1];
  expect(written.weeks[future].schedule).toHaveLength(6);
  for (const [key, week] of Object.entries(JSON.parse(original))) {
    expect(JSON.stringify(written.weeks[key])).toBe(JSON.stringify(week));
    expect(JSON.stringify(state.store.weeks[key])).toBe(JSON.stringify(week));
  }
  const { validateSchedule } = await import('../domain/validation.js');
  const validation = validateSchedule(written.weeks[future].schedule, written.EMPLOYEES, written.SH);
  expect(validation.allH && validation.apertura_ok && validation.cierre_ok).toBe(true);
  expect(state.store.persistenceStatus).toBe('persisted');
});
it.each(['id', 'edited', 'delete', 'extra'])('blocks modification of observed legacy history: %s', mutation => {
  state.store.selectedWeek = future; state.loadSelectedWeek();
  if (mutation === 'id') state.store.weeks[historical].schedule[1][4].id = 'OFF';
  if (mutation === 'edited') state.store.weeks[historical].edited[1][4] = true;
  if (mutation === 'delete') delete state.store.weeks[historical];
  if (mutation === 'extra') state.store.weeks[historical].repaired = true;
  expect(() => state.saveState()).toThrow();
  expect(firebase.set).not.toHaveBeenCalled();
});
it.each(['missing', 'null', 'malformed'])('rejects new schedule references that are %s', type => {
  state.store.selectedWeek = future; state.loadSelectedWeek();
  state.store.schedule = state.store.EMPLOYEES.map(() => Array.from({ length: 7 }, () => ({ id: 'OFF' })));
  const id = 'BadNew'; state.store.schedule[0][0].id = id;
  if (type === 'null') state.store.SH[id] = null;
  if (type === 'malformed') state.store.SH[id] = { id, start: 9, end: 17 };
  expect(() => state.saveState()).toThrow();
  expect(state.store.weeks[future]).toBeUndefined();
  expect(firebase.set).not.toHaveBeenCalled();
});
it('blocks cell edits and reset for the selected legacy week', () => {
  state.store.schedule = structuredClone(state.store.weeks[historical].schedule);
  cells.openCellEditor(1, 4);
  expect(state.store.currentEdit).toBeNull();
  state.store.currentEdit = { pi: 1, di: 4, draft: { id: 'OFF', bs: null, bd: 1 } };
  cells.confirmCellEdit();
  expect(state.store.schedule[1][4].id).toBe('X11');
  state.store.schedule = []; state.store.currentEdit = null;
  events.setupEvents(); handlers['bReset:click']();
  expect(JSON.stringify(state.store.weeks)).toBe(original);
  expect(firebase.set).not.toHaveBeenCalled();
});
it('renders explicit unresolved cells without hours, metrics or editing handlers', async () => {
  const { render } = await vi.importActual('../ui/layout.js');
  for (const view of ['person', 'day', 'hours', 'cover']) {
    state.store.view = view;
    expect(() => render()).not.toThrow();
    expect(nodes.tContainer.innerHTML).toContain('Sin definición: X11');
    expect(nodes.tContainer.innerHTML).toContain('solo lectura');
    expect(nodes.tContainer.innerHTML).toContain('Horas no disponibles');
    expect(nodes.tContainer.innerHTML).not.toContain('onclick');
    expect(nodes.metricsSide.innerHTML).toBe('');
    expect(nodes.bLock.disabled).toBe(true);
  }
});
it('allows safe unused catalog edits and deletion while preserving legacy data', () => {
  state.store.SH.Unused = { ...state.store.SH.M, id: 'Unused', builtin: false };
  const values = { edStart: '9', edEnd: '17', edDefBs: '13', edDefBd: '1', edAbbr: 'U', edName: 'Unused edited' };
  for (const [id, value] of Object.entries(values)) document.getElementById(id).value = value;
  shifts.saveShiftEdit('Unused');
  expect(state.store.SH.Unused.name).toBe('Unused edited');
  shifts.deleteShift('Unused');
  expect(state.store.SH.Unused).toBeUndefined();
  expect(firebase.set).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(state.store.weeks)).toBe(original);
  expect(JSON.stringify(firebase.set.mock.calls.at(-1)[1].weeks)).toBe(original);
});
it('keeps destructive catalog guards for resolved references within legacy history', () => {
  const proposed = { ...state.store.SH }; delete proposed.M;
  expect(state.canUseShiftCatalog(proposed)).toBe(false);
  const before = structuredClone(state.store.SH.M);
  const values = { edStart: '9', edEnd: '18', edDefBs: '13', edDefBd: '1', edAbbr: 'M', edName: 'Changed' };
  for (const [id, value] of Object.entries(values)) document.getElementById(id).value = value;
  shifts.saveShiftEdit('M');
  expect(state.store.SH.M).toEqual(before);
  expect(firebase.set).not.toHaveBeenCalled();
});
it('never reuses unresolved historical IDs for a new custom shift', () => {
  state.store.customCounter = 9;
  shifts.createCustomShift();
  expect(state.store.SH.X10).toBeUndefined();
  expect(state.store.SH.X11).toBeUndefined();
  expect(state.store.SH.X12).toBeDefined();
});
it('blocks fabricating a missing definition even if raw historical cells are unchanged', () => {
  state.store.SH.X11 = { ...state.store.SH.M, id: 'X11' };
  expect(() => state.saveState({ saveSelectedWeek: false })).toThrow();
  expect(firebase.set).not.toHaveBeenCalled();
});

it('allows active-roster additions but protects historical employee meaning', async () => {
  const { confirmAddEmployee, saveEmployeeEdit, deleteEmployee } = await import('../ui/modals/empEditor.js');
  document.getElementById('newEmpName').value = 'Synthetic new employee';
  document.getElementById('newEmpDay').value = '2';
  confirmAddEmployee();
  expect(state.store.EMPLOYEES).toHaveLength(7);
  expect(JSON.stringify(state.store.weeks)).toBe(original);
  expect(firebase.set).toHaveBeenCalledTimes(1);
  firebase.set.mockClear();
  const roster = structuredClone(state.store.EMPLOYEES);
  document.getElementById('edEmpName').value = 'Renamed';
  document.getElementById('edEmpDay').value = '0'; saveEmployeeEdit(0);
  document.getElementById('edEmpName').value = roster[0].name;
  document.getElementById('edEmpDay').value = '1'; saveEmployeeEdit(0);
  deleteEmployee(0);
  expect(state.store.EMPLOYEES[0]).toMatchObject({ id: roster[0].id, name: roster[0].name, freeDay: 1 });
  expect(state.getWeekEmployees()[0]).toMatchObject(roster[0]);
  expect(JSON.stringify(state.store.weeks)).toBe(original);
  expect(firebase.set).toHaveBeenCalledTimes(2);
});
it('escapes untrusted legacy IDs and preserves the original stored data', async () => {
  const payload = `Unknown"><img src=x onerror="bad">`;
  const weeks = JSON.parse(original); weeks[historical].schedule[1][4].id = payload;
  firebase.onValue.mock.calls[0][1]({ val: () => ({ weeks }) });
  const unchanged = JSON.stringify(state.store.weeks);
  const { render } = await vi.importActual('../ui/layout.js');
  render();
  expect(nodes.tContainer.innerHTML).toContain('Unknown&quot;&gt;&lt;img');
  expect(nodes.tContainer.innerHTML).not.toContain('<img');
  expect(nodes.tContainer.innerHTML).not.toContain('onerror="bad"');
  expect(JSON.stringify(state.store.weeks)).toBe(unchanged);
});
it('renders the historical roster count after an unrelated active roster addition', async () => {
  const { confirmAddEmployee } = await import('../ui/modals/empEditor.js');
  document.getElementById('newEmpName').value = 'Synthetic new employee';
  document.getElementById('newEmpDay').value = '2'; confirmAddEmployee();
  const { render } = await vi.importActual('../ui/layout.js'); render();
  expect(nodes.subtitleTxt.textContent).toContain('6 personas');
  expect(nodes.tContainer.innerHTML).not.toContain('Synthetic new employee');
});
