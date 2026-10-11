import { beforeEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
const firebase = vi.hoisted(() => ({ db: {}, auth: {}, ref: vi.fn(), onValue: vi.fn(), set: vi.fn(), onAuthStateChanged: vi.fn(), signOut: vi.fn(), signInWithEmailAndPassword: vi.fn() }));
vi.mock('../services/firebase.js', () => firebase);
vi.mock('../ui/layout.js', () => ({ render: vi.fn() }));
let nodes, handlers, submit;
beforeEach(async () => {
  vi.resetModules(); vi.clearAllMocks(); nodes = {}; handlers = {};
  firebase.signInWithEmailAndPassword.mockResolvedValue({});
  vi.stubGlobal('window', {});
  vi.stubGlobal('document', {
    getElementById: id => nodes[id] ||= { value: '', type: id === 'loginPwd' ? 'password' : 'email', style: {}, attributes: {}, textContent: '', disabled: false,
      setAttribute(name, value) { this.attributes[name] = value; },
      addEventListener(type, fn) { (handlers[id + ':' + type] ||= []).push(fn); } },
    querySelector: () => null, querySelectorAll: () => []
  });
  const { setupEvents } = await import('./events.js'); setupEvents(); setupEvents();
  document.getElementById('loginEmail').value = 'synthetic@example.test';
  document.getElementById('loginPwd').value = 'synthetic password';
  submit = () => {
    expect(handlers['loginForm:submit']).toHaveLength(1);
    const event = { preventDefault: vi.fn() };
    const completion = handlers['loginForm:submit'][0](event);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    return completion;
  };
});
it('uses exactly one prevented form submit and preserves the Firebase credentials path', async () => {
  await submit();
  expect(firebase.signInWithEmailAndPassword).toHaveBeenCalledTimes(1);
  expect(firebase.signInWithEmailAndPassword).toHaveBeenCalledWith(firebase.auth, 'synthetic@example.test', 'synthetic password');
  expect(handlers['bLoginSubmit:click']).toBeUndefined();
  expect(handlers['loginForm:submit']).toHaveLength(1);
});
it.each(['loginEmail', 'loginPwd'])('rejects incomplete credentials in %s without authentication', async id => {
  nodes[id].value = ''; await submit();
  expect(firebase.signInWithEmailAndPassword).not.toHaveBeenCalled();
  expect(nodes.loginError.textContent).toBe('Correo y contraseña son obligatorios.');
});
it('prevents repeated authentication calls while pending and restores idle after completion', async () => {
  let resolve;
  firebase.signInWithEmailAndPassword.mockImplementation(() => new Promise(done => { resolve = done; }));
  const completion = submit(); await submit();
  expect(firebase.signInWithEmailAndPassword).toHaveBeenCalledTimes(1);
  expect(nodes.bLoginSubmit.disabled).toBe(true); expect(nodes.bLoginSubmit.textContent).toBe('Iniciando...');
  expect(nodes.loginForm.attributes['aria-busy']).toBe('true');
  resolve(); await completion;
  expect(nodes.bLoginSubmit.disabled).toBe(false); expect(nodes.bLoginSubmit.textContent).toBe('Entrar');
  expect(nodes.loginForm.attributes['aria-busy']).toBe('false');
});
it('restores the form after failure and exposes only the generic error', async () => {
  firebase.signInWithEmailAndPassword.mockRejectedValue(new Error('PRIVATE Firebase details'));
  await submit();
  expect(nodes.loginError.textContent).toBe('Credenciales inválidas o usuario no autorizado.');
  expect(nodes.loginError.style.display).toBe('block');
  expect(nodes.bLoginSubmit.disabled).toBe(false); expect(nodes.bLoginSubmit.textContent).toBe('Entrar');
  firebase.signInWithEmailAndPassword.mockResolvedValue({}); await submit();
  expect(nodes.loginError.textContent).toBe(''); expect(firebase.signInWithEmailAndPassword).toHaveBeenCalledTimes(2);
});
it('toggles visibility and accessible state without clearing the password or authenticating', () => {
  expect(handlers['loginPwdToggle:click']).toHaveLength(1);
  const toggle = handlers['loginPwdToggle:click'][0];
  toggle(); expect(nodes.loginPwd.type).toBe('text');
  expect(nodes.loginPwdToggle.attributes['aria-label']).toBe('Ocultar contraseña');
  expect(nodes.loginPwdToggle.attributes['aria-pressed']).toBe('true');
  toggle(); expect(nodes.loginPwd.type).toBe('password');
  expect(nodes.loginPwdToggle.attributes['aria-label']).toBe('Mostrar contraseña');
  expect(nodes.loginPwdToggle.attributes['aria-pressed']).toBe('false');
  expect(nodes.loginPwd.value).toBe('synthetic password');
  expect(firebase.signInWithEmailAndPassword).not.toHaveBeenCalled();
});
it('provides native Enter submission, explicit labels, a non-submit SVG toggle and error relationships', () => {
  const html = readFileSync('index.html', 'utf8');
  expect(html).toMatch(/<form\b[^>]*id="loginForm"/);
  expect(html).toMatch(/<button\b[^>]*id="bLoginSubmit"[^>]*type="submit"/);
  expect(html).toMatch(/<button\b[^>]*id="loginPwdToggle"[^>]*type="button"/);
  expect(html).toMatch(/<input\b[^>]*type="password"[^>]*id="loginPwd"/);
  expect(html).toContain('for="loginEmail"'); expect(html).toContain('for="loginPwd"');
  expect(html).toContain('aria-describedby="loginError"'); expect(html).toContain('role="alert"');
  expect(html).toContain('aria-label="Mostrar contraseña"'); expect(html).toContain('aria-pressed="false"');
  expect(html).toContain('<svg');
});
it('restores idle state when the sign-in call throws synchronously', async () => {
  firebase.signInWithEmailAndPassword.mockImplementation(() => { throw new Error('PRIVATE implementation details'); });
  await submit();
  expect(nodes.bLoginSubmit.disabled).toBe(false);
  expect(nodes.loginForm.attributes['aria-busy']).toBe('false');
  expect(nodes.loginError.textContent).toBe('Credenciales inválidas o usuario no autorizado.');
});

// This Node suite cannot emulate native implicit submission. Model only the
// requestSubmit boundary, then observe the unchanged form/authentication handler.
function emulateRequestSubmit() {
  const form = document.getElementById('loginForm');
  form.requestSubmit = vi.fn(button => {
    expect(button).toBe(nodes.bLoginSubmit);
    return submit();
  });
  return form.requestSubmit;
}
function pressLoginKey(id, overrides = {}) {
  expect(handlers[id + ':keydown']).toHaveLength(1);
  const event = { key: 'Enter', repeat: false, isComposing: false, preventDefault: vi.fn(), ...overrides };
  handlers[id + ':keydown'][0](event);
  return event;
}
it.each(['loginEmail', 'loginPwd'])('bridges Enter in %s to one form submit/auth attempt', async id => {
  const request = emulateRequestSubmit();
  const event = pressLoginKey(id);
  expect(event.preventDefault).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledTimes(1);
  expect(firebase.signInWithEmailAndPassword).toHaveBeenCalledTimes(1);
  await request.mock.results[0].value;
});
it('blocks repeated Enter while authentication is pending', async () => {
  let resolve;
  firebase.signInWithEmailAndPassword.mockImplementation(() => new Promise(done => { resolve = done; }));
  const request = emulateRequestSubmit();
  pressLoginKey('loginPwd'); pressLoginKey('loginPwd'); pressLoginKey('loginEmail');
  expect(request).toHaveBeenCalledTimes(1);
  expect(firebase.signInWithEmailAndPassword).toHaveBeenCalledTimes(1);
  resolve(); await request.mock.results[0].value;
  pressLoginKey('loginEmail'); expect(firebase.signInWithEmailAndPassword).toHaveBeenCalledTimes(2);
  resolve(); await request.mock.results[1].value;
});
it.each([{ key: 'Tab' }, { key: 'a' }, { repeat: true }, { isComposing: true }])('does not bridge unrelated or composition/repeated keys: %j', properties => {
  const request = emulateRequestSubmit(); const event = pressLoginKey('loginPwd', properties);
  expect(request).not.toHaveBeenCalled();
  expect(firebase.signInWithEmailAndPassword).not.toHaveBeenCalled();
  if (properties.key || properties.isComposing) expect(event.preventDefault).not.toHaveBeenCalled();
});
it('leaves visibility-button and unrelated-control keyboard behavior native', () => {
  expect(handlers['loginPwdToggle:keydown']).toBeUndefined();
  expect(handlers['bLoginSubmit:keydown']).toBeUndefined();
  expect(handlers['datePicker:keydown']).toBeUndefined();
  expect(handlers['loginForm:keydown']).toBeUndefined();
  handlers['loginPwdToggle:click'][0]();
  expect(firebase.signInWithEmailAndPassword).not.toHaveBeenCalled();
});
