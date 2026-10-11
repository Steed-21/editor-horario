import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const firebase = vi.hoisted(() => ({ db: {}, auth: {}, ref: vi.fn(), onValue: vi.fn(), set: vi.fn(), onAuthStateChanged: vi.fn(), signOut: vi.fn(), signInWithEmailAndPassword: vi.fn() }));
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
  vi.stubGlobal('localStorage', { getItem: vi.fn(() => null), setItem: vi.fn() });
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
  expect(firebase.onValue).toHaveBeenCalledTimes(2);
  expect(store.isAdmin).toBe(false);
});
it.each([
  [admin, true],
  [{ ...admin, emailVerified: false }, false],
  [{ uid: 'reader', email: 'reader@example.test', emailVerified: true }, false]
])('preserves admin/read-only classification for %j', (user, expected) => {
  authChanged(user);
  expect(store.isAdmin).toBe(expected);
  expect(firebase.onValue).toHaveBeenCalledTimes(1);
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
it('updates classification for the same identity without adding another listener', () => {
  authChanged(admin); authChanged({ ...admin, emailVerified: false });
  expect(store.isAdmin).toBe(false);
  expect(nodes.bLogin.textContent).toBe('Salir (lectura)');
  expect(firebase.onValue).toHaveBeenCalledTimes(1);
});
