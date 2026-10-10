import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../services/firebase.js', () => ({ db: {}, ref: vi.fn(), onValue: vi.fn(), set: vi.fn() }));
import { store } from '../state/store.js';
import { DEFAULT_SHIFTS } from '../config/shifts.js';
import { renderPerson } from './views/person.js';
import { renderDay } from './views/day.js';
import { renderHours } from './views/hours.js';
import { renderLog } from './components/log.js';
import { openShiftBaseEditor, openSingleShiftEditor } from './modals/shiftEditor.js';
import { renderCellModal } from './modals/cellEditor.js';
import { render } from './layout.js';

const malicious = `<img src=x onerror="globalThis.pwned=1">'&`;
let nodes;
beforeEach(() => {
  delete globalThis.pwned;
  nodes = Object.fromEntries(['logPanel', 'modalTitle', 'modalBody', 'modalBg', 'tContainer', 'metricsSide', 'legendBlock'].map(id => [id, { innerHTML: '', textContent: '', style: {} }]));
  vi.stubGlobal('document', { getElementById: id => nodes[id] || null, querySelector: () => null });
  store.SH = structuredClone(DEFAULT_SHIFTS);
  store.baseDate = '2026-05-11';
  store.wo = 0;
  store.selectedWeek = null;
  store.persistenceStatus = 'listener';
  store.pendingWrite = null;
  store.writeError = null;
  store.weekStatus = 'persisted';
  store.snapshotSource = 'remote';
  store.SH.X1 = { id: 'X1', name: malicious, abbr: malicious, cls: `x" onmouseover="bad`, start: 0, end: 0, defaultBs: null, builtin: false };
  store.EMPLOYEES = [{ name: malicious, freeDay: 0 }];
  store.schedule = [Array.from({ length: 7 }, () => ({ id: 'X1', bs: null, bd: 1 }))];
  store.edited = [Array(7).fill(false)];
  store.currentDates = Array.from({ length: 7 }, () => ({ str: '11/05' }));
  store.currentEdit = { pi: 0, di: 0 };
  store.editorInvalidated = false;
  store.logEntries = [{ ts: malicious, msg: malicious, type: `ok" onmouseover="bad` }];
});

it.each([renderPerson, renderDay, renderHours])('escapes employee and shift text in %s', renderer => {
  const html = renderer();
  expect(html.toLowerCase()).not.toContain('<img');
  expect(html).not.toContain(' onmouseover="bad');
  expect(html).toContain('&lt;');
});
it('escapes every remote log field', () => {
  renderLog();
  expect(nodes.logPanel.innerHTML).not.toContain('<img');
  expect(nodes.logPanel.innerHTML).not.toContain(' onmouseover="bad');
  expect(nodes.logPanel.innerHTML).toContain('&lt;img');
});
it('escapes zero-hour labels, classes and numeric attributes in editors', () => {
  store.SH.X1.abbr = malicious;
  openShiftBaseEditor();
  expect(nodes.modalBody.innerHTML).not.toContain('<img');
  expect(nodes.modalBody.innerHTML).not.toContain(' onmouseover="bad');
  openSingleShiftEditor('X1');
  expect(nodes.modalBody.innerHTML).not.toContain('<img');
  store.currentEdit = { pi: 0, di: 0 };
  renderCellModal(store.schedule[0][0]);
  expect(nodes.modalBody.innerHTML).not.toContain('<img');
});
it.each([`X');globalThis.pwned=1;//`, `X");globalThis.pwned=1;//`, String.raw`X\"'&quot;&#39;<>&`, 'Turno ñ'])('treats remote shift ID %s as data after HTML attribute decoding', id => {
  store.SH[id] = { ...store.SH.X1, id };
  openShiftBaseEditor();
  const handlers = () => [...nodes.modalBody.innerHTML.matchAll(/onclick="([^"]*)"/g)].map(m => m[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
  const selected = vi.fn();
  const deleted = vi.fn();
  for (const handler of handlers()) Function('window', handler)({ openSingleShiftEditor: selected, deleteShift: deleted, createCustomShift: vi.fn() });
  expect(globalThis.pwned).toBeUndefined();
  expect(selected).toHaveBeenCalledWith(id);
  expect(deleted).toHaveBeenCalledWith(id);
  openSingleShiftEditor(id);
  const saved = vi.fn();
  for (const handler of handlers()) Function('window', handler)({ openShiftBaseEditor: vi.fn(), saveShiftEdit: saved });
  expect(saved).toHaveBeenCalledWith(id);
  store.currentEdit = { pi: 0, di: 0 };
  renderCellModal(store.schedule[0][0]);
  const assigned = vi.fn();
  for (const handler of handlers()) Function('window', handler)({ selectShiftForCell: assigned, confirmCellEdit: vi.fn() });
  expect(assigned).toHaveBeenCalledWith(id);
  expect(globalThis.pwned).toBeUndefined();
});

it('preserves ordinary employee names, shift labels and log text', () => {
  store.EMPLOYEES[0].name = 'Dilan';
  store.SH.X1.abbr = 'Baja';
  store.SH.X1.cls = 'tCUSTOM';
  store.logEntries = [{ ts: '10:00:00', msg: 'Horario actualizado', type: 'ok' }];
  expect(renderPerson()).toContain('Dilan');
  expect(renderPerson()).toContain('>Baja</button>');
  renderLog();
  expect(nodes.logPanel.innerHTML).toContain('Horario actualizado');
});
it('rerenders remote logs and hides an invalidated editor', () => {
  store.currentEdit = null;
  store.editorInvalidated = true;
  render();
  expect(nodes.logPanel.innerHTML).toContain('&lt;img');
  expect(nodes.modalBg.style.display).toBe('none');
});
it('renders a missing week without invoking table or metrics calculations', () => {
  store.schedule = [];
  store.edited = [];
  render();
  expect(nodes.tContainer.textContent).toContain('Sin horario');
  expect(nodes.metricsSide.innerHTML).toBe('');
});

it('preserves non-cell editors across an ordinary render', () => {
  store.currentEdit = null;
  openShiftBaseEditor();
  render();
  expect(nodes.modalBg.style.display).toBe('flex');
});

it('escapes a malicious break start in the actual break-input branch', () => {
  store.currentEdit = { pi: 0, di: 0 };
  const payload = `13" autofocus onfocus="globalThis.pwned=1"><img src=x onerror="bad">`;
  renderCellModal({ id: 'M', bs: payload, bd: 1 });
  const html = nodes.modalBody.innerHTML;
  expect(html).toContain('id="cellBs"');
  expect(html).toContain('value="13&quot; autofocus onfocus=&quot;');
  expect(html).not.toContain('<img');
  expect(html).not.toContain(' onfocus="');
});

it.each(['loading', 'cached', 'listener', 'pending', 'failed', 'persisted'])('renders truthful %s provenance for a missing week', status => {
  nodes.subtitleTxt = { textContent: '' };
  nodes.bCreateWeek = {};
  store.schedule = []; store.edited = []; store.weekStatus = 'missing';
  store.isAdmin = false; store.persistenceStatus = status;
  render();
  expect(nodes.bCreateWeek.hidden).toBe(true);
  expect(nodes.subtitleTxt.textContent).toContain('semana ausente / no publicada');
  if (status === 'persisted') expect(nodes.subtitleTxt.textContent).toContain('escritura confirmada');
  else expect(nodes.subtitleTxt.textContent).not.toContain('escritura confirmada');
  if (status === 'loading') expect(nodes.tContainer.textContent).toContain('Cargando');
  else expect(nodes.tContainer.textContent).toContain('Sin horario');
});

it('renders an unreferenced null definition as a partial catalog without crashing', () => {
  nodes.subtitleTxt = { textContent: '' };
  store.SH.bad = null;
  render();
  expect(nodes.subtitleTxt.textContent).toContain('catálogo parcial');
  openShiftBaseEditor();
  expect(nodes.modalBody.innerHTML).toContain('Catálogo parcial');
});
