import { beforeEach, expect, it, vi } from 'vitest';
const fb = vi.hoisted(() => ({ db: {}, ref: vi.fn((_, path) => path), onValue: vi.fn(), set: vi.fn() }));
vi.mock('../services/firebase.js', () => fb);
let store, syncReader, nodes, listeners;
const week = '2026-10-05';
const root = 'horario_v5_state';
const employee = (name = 'Synthetic worker') => ({ name, id: 'e1', freeDay: 0, active: true });
const schedule = [Array.from({ length: 7 }, () => ({ id: 'OFF', bs: null, bd: 1 }))];
const deliver = (path, value, occurrence = -1) => {
  const matches = listeners.filter(x => x.path === path);
  matches.at(occurrence).data({ val: () => structuredClone(value) });
};
const load = (key = week, roster = [employee()]) => {
  deliver(`${root}/SH`, shifts);
  deliver(`${root}/weeks/${key}/schedule`, schedule);
  deliver(`${root}/weekRosters/${key}`, roster);
};
let shifts;
beforeEach(async () => {
  vi.resetModules(); vi.clearAllMocks(); listeners = []; nodes = {};
  fb.onValue.mockImplementation((path, data, error) => {
    const stop = vi.fn(); listeners.push({ path, data, error, stop }); return stop;
  });
  vi.stubGlobal('localStorage', { getItem: vi.fn(() => JSON.stringify({ EMPLOYEES: [{ name: 'Private' }], logEntries: [{ msg: 'Private log' }] })), setItem: vi.fn(), removeItem: vi.fn() });
  vi.stubGlobal('window', { _renderUI: vi.fn() });
  vi.stubGlobal('document', { getElementById: id => nodes[id] ||= { innerHTML: '', textContent: '', style: {}, removeAttribute: vi.fn() }, querySelector: () => nodes.actions ||= { style: {} } });
  ({ store } = await import('./store.js'));
  ({ DEFAULT_SHIFTS: shifts } = await import('../config/shifts.js'));
  store.isAdmin = false; store.selectedWeek = week;
  ({ syncReader } = await import('./readerSync.js'));
});
it('requests only SH and the selected schedule/roster, never hydrates or writes an admin cache', () => {
  syncReader(); load();
  expect(listeners.map(x => x.path)).toEqual([`${root}/SH`, `${root}/weeks/${week}/schedule`, `${root}/weekRosters/${week}`]);
  expect(localStorage.getItem).not.toHaveBeenCalled(); expect(localStorage.setItem).not.toHaveBeenCalled();
  expect(localStorage.removeItem).toHaveBeenCalledWith(root);
  expect(store.EMPLOYEES).toEqual([]); expect(store.logEntries).toEqual([]);
  expect(store.schedule).toEqual(schedule); expect(store.edited).toEqual([Array(7).fill(false)]);
  expect(store.scheduleRoster[0].name).toBe('Synthetic worker');
});
it.each([null, {}, [{ name: null }], [{ name: 'Missing identity' }], [{ ...employee(), freeDay: null }], [{ name: '' }], [{ name: 'Wrong size' }, { name: 'Extra row' }], []].map(roster => [roster]))('uses explicit unknown attribution for unusable roster %j', roster => {
  syncReader(); load(week, roster);
  expect(store.scheduleRoster[0].name).toBe('Fila 1 · atribución desconocida');
  expect(store.weekStatus).toBe('loaded');
});
it('waits for both selected week paths and represents a missing week without generation', () => {
  syncReader(); deliver(`${root}/SH`, shifts); deliver(`${root}/weeks/${week}/schedule`, null);
  expect(store.readerStatus).toBe('loading');
  deliver(`${root}/weekRosters/${week}`, null);
  expect(store.readerStatus).toBe('ready'); expect(store.weekStatus).toBe('missing');
  expect(store.schedule).toEqual([]); expect(fb.set).not.toHaveBeenCalled();
});
it('unsubscribes old week paths and ignores stale data and errors across rapid navigation', () => {
  const stop = syncReader(); load();
  const old = listeners.slice(1); store.selectedWeek = '2026-10-12'; stop.selectWeek();
  store.selectedWeek = '2026-10-19'; stop.selectWeek();
  expect(old.every(x => x.stop.mock.calls.length === 1)).toBe(true);
  deliver(`${root}/weeks/2026-10-19/schedule`, schedule); deliver(`${root}/weekRosters/2026-10-19`, [employee('New')]);
  const before = structuredClone(store);
  old.forEach(x => { x.data({ val: () => null }); x.error(new Error('Private stale error')); });
  listeners[3].data({ val: () => null });
  expect(store).toEqual(before); expect(store.scheduleRoster[0].name).toBe('New');
  expect(listeners[0].stop).not.toHaveBeenCalled();
});
it('stops every listener exactly once and ignores post-session callbacks', () => {
  const stop = syncReader(); load(); stop(); stop();
  const before = structuredClone(store);
  listeners.forEach(x => { expect(x.stop).toHaveBeenCalledTimes(1); x.data({ val: () => shifts }); x.error(new Error('Late')); });
  expect(store).toEqual(before);
});
it('keeps failures visible without exposing backend errors or reporting persistence', async () => {
  syncReader(); listeners[1].error(new Error('permission_denied/private-details')); load();
  expect(store.readerStatus).toBe('failed'); expect(store.persistenceStatus).not.toBe('persisted');
  const { render } = await import('../ui/layout.js'); render();
  expect(nodes.statusRail.textContent).toContain('SOLO LECTURA');
  expect(nodes.tContainer.textContent).toContain('No se pudo cargar');
  expect(JSON.stringify(nodes)).not.toContain('private-details');
});
it('renders authoritative rows as readable non-editable content with no administrative UI', async () => {
  syncReader(); load();
  store.edited = [Array(7).fill(true)]; store.writeError = 'Private error'; store.logEntries = [{ msg: 'Private log' }];
  const { render } = await import('../ui/layout.js'); render();
  expect(nodes.tContainer.innerHTML).toContain('Synthetic worker');
  expect(nodes.tContainer.innerHTML).toContain('reader-shift');
  expect(nodes.tContainer.innerHTML).not.toContain('onclick='); expect(nodes.tContainer.innerHTML).not.toContain(' edited');
  expect(nodes.metricsSide.innerHTML).not.toContain('Ediciones'); expect(nodes.logPanel.hidden).toBe(true);
  expect(nodes.logPanel.innerHTML).toBe(''); expect(nodes.actions.style.display).toBe('none');
  expect(nodes.statusRail.textContent).toBe('SOLO LECTURA');
  const { saveState } = await import('./store.js'); saveState(); expect(fb.set).not.toHaveBeenCalled();
});
it('contains unresolved legacy cells without invented hours, but rejects malformed referenced definitions', async () => {
  syncReader(); load();
  const legacy = structuredClone(schedule); legacy[0][0].id = 'X11';
  deliver(`${root}/weeks/${week}/schedule`, legacy);
  expect(store.weekStatus).toBe('legacy'); expect(store.schedule).toEqual([]);
  const { render } = await import('../ui/layout.js'); render();
  expect(nodes.tContainer.innerHTML).toContain('Sin definición: X11');
  expect(nodes.tContainer.innerHTML).toContain('Horas no disponibles'); expect(nodes.metricsSide.innerHTML).toBe('');
  deliver(`${root}/SH`, { ...shifts, X11: null });
  expect(store.weekStatus).toBe('invalid'); render(); expect(nodes.tContainer.textContent).toContain('datos inválidos');
});

it('fails visibly on synchronous startup errors without adding retry listeners', () => {
  fb.onValue.mockImplementationOnce(() => { throw new Error('Internal startup detail'); });
  syncReader(); expect(store.readerStatus).toBe('failed');
  expect(listeners).toHaveLength(2);
  deliver(`${root}/weeks/${week}/schedule`, schedule); deliver(`${root}/weekRosters/${week}`, [{ name: 'Worker' }]);
  expect(store.readerStatus).toBe('failed'); expect(store.schedule).toEqual([]);
  expect(fb.onValue).toHaveBeenCalledTimes(3);
});
it('discards attribution/edited metadata on cells and never records reader activity', async () => {
  syncReader(); load();
  const injected = structuredClone(schedule); injected[0][0].edited = true; injected[0][0].employeeName = 'Untrusted attribution';
  deliver(`${root}/weeks/${week}/schedule`, injected);
  expect(store.schedule[0][0]).toEqual(schedule[0][0]); expect(store.edited.flat().some(Boolean)).toBe(false);
  const { log } = await import('../ui/components/log.js'); log('Reader private event');
  expect(store.logEntries).toEqual([]); expect(localStorage.setItem).not.toHaveBeenCalled();
});
it('does not render malformed schedule shapes or fabricate row mappings', async () => {
  syncReader(); load(); deliver(`${root}/weeks/${week}/schedule`, [[null]]);
  expect(store.weekStatus).toBe('invalid'); expect(store.schedule).toEqual([]);
  const { render } = await import('../ui/layout.js'); expect(() => render()).not.toThrow();
  expect(nodes.tContainer.textContent).toContain('datos inválidos');
});
it('escapes untrusted reader roster names and shift labels at the existing render boundary', async () => {
  syncReader(); load(week, [employee('<img src=x onerror="bad">')]);
  deliver(`${root}/SH`, { ...shifts, OFF: { ...shifts.OFF, name: '<img src=x>', abbr: '<img src=x>' } });
  const { render } = await import('../ui/layout.js'); render();
  expect(nodes.tContainer.innerHTML).not.toContain('<img'); expect(nodes.tContainer.innerHTML).toContain('&lt;img');
});
