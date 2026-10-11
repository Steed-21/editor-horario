import { beforeEach, expect, it, vi } from 'vitest';
const firebase = vi.hoisted(() => ({ db: {}, auth: {}, ref: vi.fn(), onValue: vi.fn(), set: vi.fn(() => Promise.resolve()), onAuthStateChanged: vi.fn(), signOut: vi.fn(), signInWithEmailAndPassword: vi.fn() }));
vi.mock('../services/firebase.js', () => firebase);
vi.mock('../ui/layout.js', () => ({ render: vi.fn() }));
let state, editor, events, nodes, handlers, source, original;
const key = '2027-01-04', future = '2027-01-18';
beforeEach(async () => {
  vi.resetModules(); vi.clearAllMocks();
  nodes = {}; handlers = {};
  vi.stubGlobal('window', { _renderUI: vi.fn() });
  vi.stubGlobal('localStorage', { getItem: vi.fn(() => null), setItem: vi.fn() });
  vi.stubGlobal('document', { getElementById: id => nodes[id] ||= { style: {}, value: '', innerHTML: '', textContent: '', addEventListener: (event, fn) => { (handlers[id + ':' + event] ||= []).push(fn); } }, querySelector: () => null, querySelectorAll: () => [] });
  state = await import('./store.js'); editor = await import('../ui/modals/empEditor.js'); events = await import('../controllers/events.js');
  const { DEFAULT_SHIFTS } = await import('../config/shifts.js');
  const employees = [0, 1, 1, 4, 3, 2].map((freeDay, i) => ({ name: `Synthetic ${i}`, freeDay }));
  source = { EMPLOYEES: employees, SH: structuredClone(DEFAULT_SHIFTS), baseDate: key, weeks: { [key]: { schedule: employees.map(() => Array.from({ length: 7 }, () => ({ id: 'OFF' }))) } }, logEntries: [] };
  original = JSON.stringify(source.weeks);
  Object.assign(state.store, { selectedWeek: key, baseDate: key }); state.syncState();
  firebase.onValue.mock.calls[0][1]({ val: () => structuredClone(source) }); state.store.isAdmin = true;
});
function edit(name, day) {
  editor.openEmployeeEdit(0);
  document.getElementById('edEmpName').value = name;
  document.getElementById('edEmpDay').value = String(day);
  editor.saveEmployeeEdit(0);
}
async function createFuture() {
  await Promise.resolve();
  events.setupEvents(); handlers['datePicker:change'][0]({ target: { value: future } }); handlers['bCreateWeek:click'][0]();
}
it('changes future defaults and names without changing historical attribution or bytes', async () => {
  const id = state.getWeekEmployees()[0].id;
  edit('Synthetic renamed', 4);
  expect(state.store.EMPLOYEES[0].freeDay).toBe(4);
  expect(state.store.EMPLOYEES[0].id).toBe(id);
  expect(state.getWeekEmployees()[0].name).toBe('Synthetic 0');
  expect(JSON.stringify(state.store.weeks)).toBe(original);
  expect(JSON.stringify(firebase.set.mock.calls[0][1].weeks)).toBe(original);
  await createFuture();
  expect(state.store.schedule[0][4].id).toBe('OFF');
  expect(state.getWeekEmployees()[0]).toMatchObject({ id, name: 'Synthetic renamed', freeDay: 4 });
  expect(JSON.stringify(state.store.weeks[key])).toBe(JSON.stringify(source.weeks[key]));
});
it.each([0, 1, 2, 3, 4, 5, 6])('accepts weekday %i and preserves generation invariants or explicit infeasibility', async day => {
  edit('Synthetic 0', day);
  expect(state.store.EMPLOYEES[0].freeDay).toBe(day);
  await createFuture();
  if (day === 1) {
    expect(state.store.schedule).toEqual([]);
    expect(state.store.weeks[future]).toBeUndefined();
    expect(state.store.logEntries[0].msg).toContain('Schedule generation failed');
    expect(firebase.set).toHaveBeenCalledTimes(1);
    return;
  }
  expect(state.store.schedule).toHaveLength(6);
  expect(state.store.schedule[0][day].id).toBe('OFF');
  const { validateSchedule } = await import('../domain/validation.js');
  const result = validateSchedule(state.store.schedule, state.getWeekEmployees(), state.store.SH);
  expect(result.allH && result.apertura_ok && result.cierre_ok).toBe(true);
  expect(JSON.stringify(state.store.weeks[key])).toBe(JSON.stringify(source.weeks[key]));
});
it.each(['', '1junk', '1.5', '-1', '7', 'NaN'])('rejects invalid default %s exactly once', value => {
  edit('Synthetic 0', value);
  expect(state.store.EMPLOYEES[0].freeDay).toBe(0);
  expect(firebase.set).not.toHaveBeenCalled();
  expect(state.store.logEntries).toHaveLength(1);
});
it('offers seven labelled native options and future-only guidance', () => {
  editor.openEmployeeEdit(0);
  const html = nodes.modalBody.innerHTML;
  for (let day = 0; day < 7; day++) expect(html).toContain(`value="${day}"`);
  expect(html).toContain('for="edEmpDay"'); expect(html).toContain('futuras');
});
it('deactivates historical identities without removing or remapping rows', async () => {
  const historical = structuredClone(state.getWeekEmployees());
  editor.deactivateEmployee(0);
  expect(state.store.EMPLOYEES[0].active).toBe(false);
  expect(state.getWeekEmployees()).toEqual(historical);
  expect(JSON.stringify(state.store.weeks)).toBe(original);
  await createFuture();
  if (state.store.schedule.length) expect(state.getWeekEmployees().map(e => e.id)).not.toContain(historical[0].id);
  state.store.selectedWeek = key; state.loadSelectedWeek(); expect(state.getWeekEmployees()).toEqual(historical);
  firebase.set.mockClear(); editor.deleteEmployee(state.store.EMPLOYEES[0].id); expect(firebase.set).not.toHaveBeenCalled();
});
it('adds then explicitly deletes an unused identity without remapping history', async () => {
  const roster = structuredClone(state.getWeekEmployees());
  document.getElementById('newEmpName').value = 'Synthetic new'; document.getElementById('newEmpDay').value = '2';
  editor.confirmAddEmployee();
  const id = state.store.EMPLOYEES.at(-1).id; expect(id).toBeTruthy();
  expect(state.getWeekEmployees()).toEqual(roster); expect(JSON.stringify(state.store.weeks)).toBe(original);
  await Promise.resolve(); await Promise.resolve();
  expect((await state.deleteCatalogEmployee({ employeeId: id, confirmation: 'ELIMINAR' })).ok).toBe(true);
  expect(state.getWeekEmployees()).toEqual(roster);
  editor.confirmAddEmployee(); expect(state.store.EMPLOYEES.at(-1).id).not.toBe(id);
});
it('migrates deterministically and idempotently without writes, preserving old week objects', async () => {
  const { migrateRosterState } = await import('../domain/roster.js');
  const first = migrateRosterState(source), second = migrateRosterState(first);
  expect(second).toEqual(first); expect(first.schemaVersion).toBe(2);
  expect(first.EMPLOYEES.every(e => typeof e.id === 'string')).toBe(true);
  expect(first.weekRosters[key]).toMatchObject(first.EMPLOYEES);
  expect(JSON.stringify(first.weeks)).toBe(original); expect(JSON.stringify(source.weeks)).toBe(original);
  expect(firebase.set).not.toHaveBeenCalled();
});
it('keeps one employee action and log when event setup is repeated', () => {
  events.setupEvents(); events.setupEvents();
  expect(handlers['bEditEmps:click']).toHaveLength(1);
  edit('Synthetic 0', 4);
  expect(firebase.set).toHaveBeenCalledTimes(1); expect(state.store.logEntries).toHaveLength(1);
});

it('keeps persisted identity attribution across reload and catalog reordering', () => {
  edit('Synthetic renamed', 4);
  const written = structuredClone(firebase.set.mock.calls[0][1]);
  written.EMPLOYEES.reverse();
  firebase.onValue.mock.calls[0][1]({ val: () => written });
  expect(state.getWeekEmployees().map(e => e.name)).toEqual(source.EMPLOYEES.map(e => e.name));
  expect(state.getWeekEmployees()[0].id).toBe('legacy-employee-1');
  expect(JSON.stringify(state.store.weeks)).toBe(original);
});
it('blocks accidental changes to an observed historical roster sidecar', () => {
  state.store.weekRosters[key][0].name = 'Wrong attribution';
  expect(() => state.saveState({ saveSelectedWeek: false })).toThrow(/attribution/);
  expect(firebase.set).not.toHaveBeenCalled();
});
it('preserves unknown legacy attribution as readable and non-editable without inventing identity', async () => {
  const incoming = structuredClone(source); incoming.EMPLOYEES = incoming.EMPLOYEES.slice(0, 2);
  incoming.weeks[key].schedule[0][0] = { id: 'M' };
  const bytes = JSON.stringify(incoming.weeks);
  firebase.onValue.mock.calls[0][1]({ val: () => incoming });
  expect(state.store.weekStatus).toBe('legacy');
  expect(state.getWeekEmployees()[2].id).toBeNull();
  const { render } = await vi.importActual('../ui/layout.js');
  expect(() => render()).not.toThrow(); expect(nodes.tContainer.innerHTML).toContain('atribución desconocida');
  const { openCellEditor } = await import('../ui/modals/cellEditor.js');
  openCellEditor(2, 0); expect(state.store.currentEdit).toBeNull();
  expect(JSON.stringify(state.store.weeks)).toBe(bytes);
  expect(firebase.set).not.toHaveBeenCalled();
});
it('does not mutate or write from reader employee actions', () => {
  state.store.isAdmin = false;
  edit('Synthetic renamed', 4); editor.deactivateEmployee(0); editor.deleteEmployee(state.store.EMPLOYEES[0].id);
  expect(state.store.EMPLOYEES[0].name).toBe('Synthetic 0');
  expect(firebase.set).not.toHaveBeenCalled(); expect(state.store.logEntries).toEqual([]);
});

it('fails safely on a malformed historical week instead of routing it to the legacy renderer', async () => {
  firebase.onValue.mock.calls[0][1]({ val: () => ({ ...source, weeks: { [key]: {} } }) });
  expect(state.store.weekStatus).toBe('invalid');
  const { render } = await vi.importActual('../ui/layout.js');
  expect(() => render()).not.toThrow(); expect(nodes.tContainer.textContent).toContain('inválidos');
});
it('shows observed legacy attribution without claiming to recover original metadata', async () => {
  const { render } = await vi.importActual('../ui/layout.js'); render();
  expect(nodes.statusRail.innerHTML).toContain('original sin verificar');
});
it('excludes a deactivated added identity from a successful future week and preserves saved attribution', async () => {
  document.getElementById('newEmpName').value = 'Synthetic temporary';
  document.getElementById('newEmpDay').value = '2'; editor.confirmAddEmployee();
  const id = state.store.EMPLOYEES[6].id; editor.deactivateEmployee(6);
  await createFuture();
  expect(state.store.schedule).toHaveLength(6);
  expect(state.getWeekEmployees().some(e => e.id === id)).toBe(false);
  expect(JSON.stringify(state.store.weeks[key])).toBe(JSON.stringify(source.weeks[key]));
  const persistedRoster = structuredClone(state.store.weekRosters[future]);
  state.store.EMPLOYEES[0].name = 'Later current default';
  expect(state.store.weekRosters[future]).toEqual(persistedRoster);
  expect(firebase.set.mock.calls.at(-1)[1].weekRosters[future]).toEqual(persistedRoster);
});

it('keeps weekly controls separate from the global catalog modal', () => {
  editor.openEmployeesEditor();
  expect(nodes.modalBody.innerHTML).toContain('Equipo general');
  expect(nodes.modalBody.innerHTML).not.toContain('Modificar equipo de esta semana');
  expect(nodes.modalBody.innerHTML).not.toContain('weekTeamHeading');
});
