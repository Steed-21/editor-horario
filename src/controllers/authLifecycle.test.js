import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const firebase = vi.hoisted(() => ({ db: {}, auth: {}, ref: vi.fn((_, path) => path), onValue: vi.fn(), set: vi.fn(), onAuthStateChanged: vi.fn(), signOut: vi.fn(), signInWithEmailAndPassword: vi.fn() }));
vi.mock('../services/firebase.js', () => firebase);
vi.mock('../ui/layout.js', () => ({ render: vi.fn() }));
let store, nodes, stops;
const admin = { uid: 'admin', email: 'admin@example.test', emailVerified: true };
const authChanged = user => firebase.onAuthStateChanged.mock.calls[0][1](user);
const deliver = (index, msg) => firebase.onValue.mock.calls[index][1]({ val: () => ({ weeks: {}, logEntries: [{ msg }] }) });
beforeEach(async () => {
  vi.resetModules(); vi.clearAllMocks();
  vi.stubEnv('VITE_ADMIN_EMAIL', admin.email);
  nodes = {}; stops = [];
  firebase.onValue.mockImplementation(() => { const stop = vi.fn(); stops.push(stop); return stop; });
  firebase.set.mockImplementation(() => Promise.resolve());
  vi.stubGlobal('window', {});
  vi.stubGlobal('localStorage', { getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn() });
  vi.stubGlobal('document', {
    getElementById: id => nodes[id] ||= { style: {}, value: '', textContent: '', addEventListener: vi.fn() },
    querySelector: selector => selector === '.container' ? (nodes.container ||= { style: { display: 'none' } }) : null, querySelectorAll: () => []
  });
  ({ store } = await import('../state/store.js'));
  await import('../main.js');
});
afterEach(() => vi.unstubAllEnvs());
it('does not read cache or start RTDB before authenticated Auth resolution', () => {
  expect(firebase.onAuthStateChanged).toHaveBeenCalledTimes(1);
  expect(firebase.onValue).not.toHaveBeenCalled();
  expect(localStorage.getItem).not.toHaveBeenCalled();
  authChanged(null);
  expect(firebase.onValue).not.toHaveBeenCalled();
  expect(localStorage.getItem).not.toHaveBeenCalled();
  expect(nodes.container.style.display).toBe('none');
  expect(nodes.loginBg.style.display).toBe('flex');
});
it('starts exactly one listener and hydrates cache only after authentication', () => {
  expect(firebase.onValue).not.toHaveBeenCalled();
  authChanged(admin); authChanged({ ...admin });
  expect(firebase.onValue).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem).toHaveBeenCalledTimes(1);
  expect(nodes.container.style.display).toBe('');
  expect(nodes.loginBg.style.display).toBe('none');
});
it('unsubscribes on sign-out and ignores stale data/error callbacks', () => {
  authChanged(admin); deliver(0, 'Before sign-out');
  authChanged(null); authChanged(null);
  expect(stops[0]).toHaveBeenCalledTimes(1);
  const before = structuredClone(store);
  localStorage.setItem.mockClear(); window._renderUI.mockClear();
  deliver(0, 'Stale'); firebase.onValue.mock.calls[0][2](new Error('Stale error'));
  expect(store).toEqual(before);
  expect(localStorage.setItem).not.toHaveBeenCalled();
  expect(window._renderUI).not.toHaveBeenCalled();
  expect(store.isAdmin).toBe(false);
  expect(nodes.container.style.display).toBe('none');
});
it('creates one fresh listener after re-authentication and ignores the old lifecycle', () => {
  authChanged(admin); authChanged(null); authChanged(admin); authChanged({ ...admin });
  expect(firebase.onValue).toHaveBeenCalledTimes(2);
  expect(stops[0]).toHaveBeenCalledTimes(1);
  expect(stops[1]).not.toHaveBeenCalled();
  deliver(1, 'Fresh'); deliver(0, 'Old');
  expect(store.logEntries[0].msg).toBe('Fresh');
});
it('replaces the listener when the authenticated identity changes', () => {
  authChanged(admin); authChanged({ uid: 'reader', email: 'reader@example.test', emailVerified: true });
  expect(stops[0]).toHaveBeenCalledTimes(1);
  expect(firebase.onValue).toHaveBeenCalledTimes(4);
  expect(firebase.onValue.mock.calls.slice(1).map(call => call[0])).not.toContain('horario_v5_state');
  expect(store.isAdmin).toBe(false);
});
it.each([
  [admin, true],
  [{ ...admin, emailVerified: false }, false],
  [{ uid: 'reader', email: 'reader@example.test', emailVerified: true }, false]
])('preserves admin/read-only classification for %j', (user, expected) => {
  authChanged(user);
  expect(store.isAdmin).toBe(expected);
  expect(firebase.onValue).toHaveBeenCalledTimes(expected ? 1 : 3);
  expect(nodes.bLogin.textContent).toBe(expected ? 'Salir' : 'Salir (lectura)');
});
it.each(['Permission denied', 'Network unavailable'])('retains visible failed synchronization: %s', message => {
  authChanged(admin);
  firebase.onValue.mock.calls[0][2](new Error(message));
  expect(store.persistenceStatus).toBe('failed');
  expect(store.writeError).toContain(message);
  deliver(0, 'Late delivery'); authChanged({ ...admin });
  expect(store.persistenceStatus).toBe('failed');
  expect(store.writeError).toContain(message);
  expect(firebase.onValue).toHaveBeenCalledTimes(1);
  expect(window._renderUI).toHaveBeenCalled();
});
it('returns an idempotent unsubscribe function from syncState', async () => {
  const { syncState } = await import('../state/store.js');
  const stop = syncState();
  expect(stop).toBeTypeOf('function');
  stop(); stop();
  expect(stops.at(-1)).toHaveBeenCalledTimes(1);
});
it('ignores write completions after sign-out and a fresh sign-in', async () => {
  let finish;
  firebase.set.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  authChanged(admin);
  const { saveState } = await import('../state/store.js');
  const write = saveState(); authChanged(null); authChanged(admin);
  expect(store.pendingWrite).toBeNull();
  const before = structuredClone(store);
  finish(); await write;
  expect(store).toEqual(before);
});
it('does not let a successful write clear a listener failure', async () => {
  let finish;
  firebase.set.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  authChanged(admin);
  const { saveState } = await import('../state/store.js');
  const write = saveState();
  firebase.onValue.mock.calls[0][2](new Error('Permission denied'));
  finish(); await write;
  expect(store.persistenceStatus).toBe('failed');
  expect(store.writeError).toContain('Permission denied');
});

it.each(['Permission denied', 'Network unavailable'])('renders the synchronization failure message: %s', async message => {
  const realLayout = await vi.importActual('../ui/layout.js');
  window._renderUI = realLayout.render;
  authChanged(admin);
  firebase.onValue.mock.calls[0][2](new Error(message));
  expect(nodes.statusRail.innerHTML).toContain('guardado/sincronización fallido');
  expect(nodes.statusRail.innerHTML).toContain(message);
  expect(nodes.statusRail.innerHTML).not.toContain('escritura confirmada');
  expect(nodes.container.style.display).toBe('');
});
it('reports a synchronous listener startup failure and starts fresh only on re-authentication', () => {
  firebase.onValue.mockImplementationOnce(() => { throw new Error('Listener unavailable'); });
  authChanged(admin); authChanged({ ...admin });
  expect(store.persistenceStatus).toBe('failed');
  expect(store.writeError).toContain('Listener unavailable');
  expect(firebase.onValue).toHaveBeenCalledTimes(1);
  authChanged(null); authChanged(admin);
  expect(firebase.onValue).toHaveBeenCalledTimes(2);
  expect(store.persistenceStatus).toBe('loading');
});
it('replaces the privileged listener when classification changes for the same identity', () => {
  authChanged(admin); authChanged({ ...admin, emailVerified: false });
  expect(store.isAdmin).toBe(false);
  expect(nodes.bLogin.textContent).toBe('Salir (lectura)');
  expect(stops[0]).toHaveBeenCalledTimes(1);
  expect(firebase.onValue).toHaveBeenCalledTimes(4);
});

it('never hydrates private admin cache for an authenticated worker', () => {
  localStorage.getItem.mockReturnValue(JSON.stringify({ EMPLOYEES: [{ name: 'Private catalog', freeDay: 0 }], logEntries: [{ msg: 'Private activity' }] }));
  authChanged({ uid: 'worker', email: 'worker@example.test', emailVerified: true });
  expect(localStorage.getItem).not.toHaveBeenCalled();
  expect(store.logEntries).toEqual([]); expect(store.EMPLOYEES).toEqual([]);
});

it.each([
  ['admin logout reader', [admin, null, { uid: 'reader', email: 'reader@example.test', emailVerified: true }]],
  ['reader logout admin', [{ uid: 'reader', email: 'reader@example.test', emailVerified: true }, null, admin]],
  ['reader identity change', [{ uid: 'a', email: 'a@example.test' }, { uid: 'b', email: 'b@example.test' }]],
])('isolates all listener callbacks across %s', (_label, users) => {
  authChanged(users[0]); const oldCount = stops.length;
  store.currentEdit = { pi: 0, di: 0 }; store.writeError = 'Private error';
  document.getElementById('modalBody').textContent = 'Private editor content';
  document.getElementById('modalTitle').textContent = 'Private editor title';
  users.slice(1).forEach(authChanged);
  expect(stops.slice(0, oldCount).every(stop => stop.mock.calls.length === 1)).toBe(true);
  expect(store.currentEdit).toBeNull(); expect(store.writeError).toBeNull();
  expect(nodes.modalBody.textContent).toBe(''); expect(nodes.modalTitle.textContent).toBe('');
  expect(localStorage.removeItem).toHaveBeenCalledWith('horario_v5_state');
  const before = structuredClone(store);
  firebase.onValue.mock.calls.slice(0, oldCount).forEach(call => {
    call[1]({ val: () => ({ logEntries: [{ msg: 'Private stale log' }], EMPLOYEES: [{ name: 'Private' }] }) });
    call[2](new Error('Private stale failure'));
  });
  expect(store).toEqual(before);
});
it('routes reader navigation and date selection through fresh selected-week subscriptions only', () => {
  store.selectedWeek = '2026-10-05';
  const worker = { uid: 'reader', email: 'reader@example.test', emailVerified: true };
  authChanged(worker); authChanged({ ...worker });
  expect(firebase.onValue).toHaveBeenCalledTimes(3);
  const click = id => nodes[id].addEventListener.mock.calls.find(call => call[0] === 'click')[1]();
  click('bNext'); click('bNext');
  const change = nodes.datePicker.addEventListener.mock.calls.find(call => call[0] === 'change')[1];
  change({ target: { value: '2026-11-04' } });
  expect(store.selectedWeek).toBe('2026-11-02');
  expect(firebase.onValue.mock.calls.map(call => call[0])).toEqual([
    'horario_v5_state/SH',
    'horario_v5_state/weeks/2026-10-05/schedule', 'horario_v5_state/weekRosters/2026-10-05',
    'horario_v5_state/weeks/2026-10-12/schedule', 'horario_v5_state/weekRosters/2026-10-12',
    'horario_v5_state/weeks/2026-10-19/schedule', 'horario_v5_state/weekRosters/2026-10-19',
    'horario_v5_state/weeks/2026-11-02/schedule', 'horario_v5_state/weekRosters/2026-11-02'
  ]);
  expect(stops.slice(1, 7).every(stop => stop.mock.calls.length === 1)).toBe(true);
  expect(firebase.set).not.toHaveBeenCalled(); expect(localStorage.setItem).not.toHaveBeenCalled();
});
it('preserves the administrator root listener, log, provenance rail and edit markers', async () => {
  authChanged(admin);
  const { DEFAULT_SHIFTS } = await import('../config/shifts.js');
  const key = store.selectedWeek;
  firebase.onValue.mock.calls[0][1]({ val: () => ({ schemaVersion: 2, SH: DEFAULT_SHIFTS,
    EMPLOYEES: [{ id: 'e1', name: 'Synthetic admin row', freeDay: 0, active: true }],
    weeks: { [key]: { schedule: [Array.from({ length: 7 }, () => ({ id: 'OFF' }))], edited: [Array(7).fill(true)] } },
    weekRosters: { [key]: [{ id: 'e1', name: 'Synthetic admin row', freeDay: 0, active: true }] },
    logEntries: [{ ts: '10:00', msg: 'Synthetic activity', type: 'info' }] }) });
  const { render } = await vi.importActual('../ui/layout.js'); render();
  expect(firebase.onValue.mock.calls.map(call => call[0])).toEqual(['horario_v5_state']);
  expect(nodes.logPanel.hidden).toBe(false); expect(nodes.logPanel.innerHTML).toContain('Synthetic activity');
  expect(nodes.statusRail.innerHTML).toContain('listener');
  expect(nodes.tContainer.innerHTML).toContain(' edited'); expect(nodes.tContainer.innerHTML).toContain('onclick=');
  expect(nodes.metricsSide.innerHTML).toContain('Ediciones');
});
