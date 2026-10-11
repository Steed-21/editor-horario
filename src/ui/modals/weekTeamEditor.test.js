import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ store: {}, mutateWeekRoster: vi.fn(), getCurrentWeekStr: vi.fn(), getWeekEmployees: vi.fn(), isLegacyWeek: vi.fn() }));
vi.mock('../../state/store.js', () => api);
vi.mock('./modal.js', () => ({ openModal: vi.fn() }));
import { openWeekTeamEditor } from './weekTeamEditor.js';
import { DEFAULT_SHIFTS } from '../../config/shifts.js';
let nodes, buttons;
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 14, 12)); vi.clearAllMocks();
  const employees = ['a', 'b', 'c'].map((id, freeDay) => ({ id, name: `Synthetic ${id}`, freeDay, active: true }));
  const key = '2026-10-12';
  Object.assign(api.store, { isAdmin: true, pendingWrite: null, weekStatus: 'loaded', EMPLOYEES: employees,
    SH: DEFAULT_SHIFTS, weekRosters: { [key]: employees.slice(0, 2) },
    weeks: { [key]: { schedule: [0, 1].map(() => Array.from({ length: 7 }, () => ({ id: 'OFF' }))), edited: [Array(7).fill(false), Array(7).fill(false)] } } });
  api.getCurrentWeekStr.mockReturnValue(key);
  api.getWeekEmployees.mockImplementation(() => api.store.weekRosters[api.getCurrentWeekStr()] || []);
  api.isLegacyWeek.mockReturnValue(false); api.mutateWeekRoster.mockResolvedValue({ ok: true });
  buttons = [];
  nodes = { modalTitle: {}, modalBody: { innerHTML: '', querySelectorAll: () => buttons }, weekTeamError: {}, weekAddCandidate: { value: 'c' } };
  vi.stubGlobal('document', { getElementById: id => nodes[id] });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
function select(key) {
  api.store.weeks[key] = api.store.weeks['2026-10-12'];
  api.store.weekRosters[key] = api.store.weekRosters['2026-10-12'];
  api.getCurrentWeekStr.mockReturnValue(key);
}
it('shows labelled native current-week add, replace and remove controls', () => {
  openWeekTeamEditor(); const html = nodes.modalBody.innerHTML;
  expect(html).toContain('for="weekAddCandidate"'); expect(html).toContain('<select id="weekAddCandidate"');
  expect(html).toContain('data-week-operation="add"');
  expect(html).toContain('data-week-operation="replace"'); expect(html).toContain('data-week-operation="remove"');
  expect(html).toContain('role="alert"'); expect(html).toContain('Se añade con la semana en libre');
});
it('shows a locked past roster with no mutation controls', () => {
  select('2026-10-05'); openWeekTeamEditor();
  expect(nodes.modalBody.innerHTML).toContain('Histórico: esta semana está cerrada.');
  expect(nodes.modalBody.innerHTML).toContain('Synthetic a');
  expect(nodes.modalBody.innerHTML).not.toContain('data-week-operation');
});
it('offers future controls using stable ids and escapes catalog and roster text', () => {
  select('2026-10-19'); api.store.EMPLOYEES[2].name = '<img onerror=bad>';
  api.store.weekRosters['2026-10-19'][0].name = 'Name " <script>';
  openWeekTeamEditor(); const html = nodes.modalBody.innerHTML;
  expect(html).toContain('data-target="a"'); expect(html).toContain('value="c"');
  expect(html).toContain('data-week-operation="replace"'); expect(html).toContain('data-week-operation="remove"');
  expect(html).toContain('&lt;img'); expect(html).not.toContain('<img'); expect(html).not.toContain('<script>');
});
it('explains no eligible candidates without a broken select', () => {
  api.store.EMPLOYEES[2].active = false; openWeekTeamEditor();
  expect(nodes.modalBody.innerHTML).toContain('No hay empleados activos disponibles');
  expect(nodes.modalBody.innerHTML).not.toContain('weekAddCandidate');
});
it.each(['legacy', 'invalid', 'missing'])('renders %s as non-editable', status => {
  api.store.weekStatus = status; openWeekTeamEditor();
  expect(nodes.modalBody.innerHTML).not.toContain('data-week-operation');
});
it('does not expose or update editor content for a reader', () => {
  api.store.isAdmin = false; nodes.modalBody.innerHTML = 'Unchanged'; openWeekTeamEditor();
  expect(nodes.modalBody.innerHTML).toBe('Unchanged'); expect(api.mutateWeekRoster).not.toHaveBeenCalled();
});
it('disables pending controls and reports a rejected operation through the alert', async () => {
  let click;
  const button = { disabled: false, dataset: { weekOperation: 'add', select: 'weekAddCandidate' }, addEventListener: (_event, fn) => { click = fn; } };
  buttons = [button]; api.mutateWeekRoster.mockResolvedValue({ ok: false, error: 'Synthetic failure' });
  openWeekTeamEditor(); await click();
  expect(api.mutateWeekRoster).toHaveBeenCalledTimes(1);
  expect(api.mutateWeekRoster).toHaveBeenCalledWith({ week: '2026-10-12', operation: 'add', candidateId: 'c', targetId: undefined, confirmation: undefined, confirmed: false });
  expect(button.disabled).toBe(true); expect(nodes.weekTeamError.textContent).toBe('Synthetic failure');
  api.store.pendingWrite = 1; openWeekTeamEditor(); expect(nodes.modalBody.innerHTML).toContain('disabled');
});
it.each(['replace', 'remove'])('requires a separate current-week %s confirmation view', async operation => {
  let click;
  const button = { disabled: false, dataset: { weekOperation: operation, target: 'a', select: 'weekReplace0' }, addEventListener: (_event, fn) => { click = fn; } };
  buttons = [button]; nodes.weekReplace0 = { value: 'c' };
  for (const id of ['applyConfirmation', 'cancelConfirmation', 'destructiveConfirmation']) nodes[id] = { value: '', addEventListener: vi.fn() };
  openWeekTeamEditor(); await click();
  expect(api.mutateWeekRoster).not.toHaveBeenCalled();
  expect(nodes.modalBody.innerHTML).toContain(operation === 'replace'
    ? 'Sustituir cambia la atribución de toda la fila de esta semana, incluidos los días ya transcurridos.'
    : 'Esto también elimina los días ya transcurridos de esta fila.');
  expect(nodes.modalBody.innerHTML).toContain(operation === 'remove' ? 'destructiveConfirmation' : 'Confirmar sustitución');
});
