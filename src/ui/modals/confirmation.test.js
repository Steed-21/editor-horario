import { beforeEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ store: { isAdmin: true, activeEditor: {} } }));
vi.mock('../../state/store.js', () => api);
vi.mock('./modal.js', () => ({ openModal: vi.fn() }));
import { openConfirmation } from './confirmation.js';
let nodes, events, confirm, cancel;
beforeEach(() => {
  events = {}; nodes = {};
  vi.stubGlobal('document', { getElementById: id => nodes[id] ||= { value: '', disabled: id === 'applyConfirmation', addEventListener: (event, fn) => { events[`${id}:${event}`] = fn; } } });
  api.store.isAdmin = true; api.store.activeEditor = {};
  confirm = vi.fn().mockResolvedValue({ ok: true }); cancel = vi.fn();
});
function open(typed = true) { openConfirmation({ title: 'Confirm operation', messages: ['Unsafe <img>', 'Scope warning'], typed, onConfirm: confirm, onCancel: cancel }); }
it.each(['', 'eliminar', ' ELIMINAR', 'ELIMINAR ', 'ELIMINAR'])('only accepts exact typed confirmation: %s', async value => {
  open(); nodes.destructiveConfirmation.value = value; events['destructiveConfirmation:input']();
  expect(nodes.applyConfirmation.disabled).toBe(value !== 'ELIMINAR');
  await events['applyConfirmation:click']();
  expect(confirm.mock.calls.length).toBe(value === 'ELIMINAR' ? 1 : 0);
  expect(nodes.modalBody.innerHTML).toContain('for="destructiveConfirmation"');
  expect(nodes.modalBody.innerHTML).toContain('role="alert"');
  expect(nodes.modalBody.innerHTML).toContain('&lt;img&gt;');
});
it('requires an explicit replace click without a typed field', async () => {
  open(false); nodes.applyConfirmation.disabled = false;
  expect(confirm).not.toHaveBeenCalled();
  await events['applyConfirmation:click'](); expect(confirm).toHaveBeenCalledTimes(1);
  expect(nodes.modalBody.innerHTML).not.toContain('id="destructiveConfirmation"');
});
it('cancel does not mutate and a failure remains in the alert', async () => {
  open(); events['cancelConfirmation:click'](); expect(confirm).not.toHaveBeenCalled();
  confirm.mockResolvedValue({ ok: false, error: 'Write failed' });
  nodes.destructiveConfirmation.value = 'ELIMINAR'; events['destructiveConfirmation:input']();
  await events['applyConfirmation:click'](); expect(nodes.confirmationError.textContent).toBe('Write failed');
});
it('prevents repeated confirmation while the write promise is pending', async () => {
  let resolve; confirm.mockImplementation(() => new Promise(done => { resolve = done; }));
  open(); nodes.destructiveConfirmation.value = 'ELIMINAR'; events['destructiveConfirmation:input']();
  const pending = events['applyConfirmation:click'](); await events['applyConfirmation:click']();
  expect(confirm).toHaveBeenCalledTimes(1); resolve({ ok: true }); await pending;
});
