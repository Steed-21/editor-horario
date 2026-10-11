import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../../services/firebase.js', () => ({ db: {}, ref: vi.fn(), onValue: vi.fn(), set: vi.fn() }));
import { openModal, closeModal } from './modal.js';
import { store } from '../../state/store.js';
let doc, trigger, first, last, dialog, overlay, background, handlers, observer;
beforeEach(() => {
  handlers = new Map();
  doc = { activeElement: null, addEventListener: vi.fn((type, fn) => handlers.set(type, fn)), removeEventListener: vi.fn(type => handlers.delete(type)) };
  const control = () => ({ isConnected: true, disabled: false, tabIndex: 0, closest: () => null, getClientRects: () => [1], focus() { doc.activeElement = this; } });
  trigger = control(); first = control(); last = control();
  background = { inert: false };
  dialog = { ...control(), contains: node => [dialog, first, last].includes(node), querySelector: () => null, querySelectorAll: () => [first, last] };
  overlay = { style: { display: 'none' }, parentElement: { children: [background] } };
  overlay.parentElement.children.push(overlay);
  doc.getElementById = id => ({ modalBg: overlay, modalBox: dialog, modalClose: last })[id];
  doc.activeElement = trigger;
  vi.stubGlobal('document', doc);
  vi.stubGlobal('MutationObserver', class { constructor(fn) { observer = fn; } observe() {} disconnect() {} });
});
afterEach(() => { closeModal(); vi.unstubAllGlobals(); });
const key = (key, shiftKey = false) => {
  const event = { key, shiftKey, preventDefault: vi.fn() };
  handlers.get('keydown')?.(event);
  return event;
};
it('moves focus inside and makes only background siblings inert', () => {
  openModal();
  expect(doc.activeElement).toBe(first);
  expect(background.inert).toBe(true);
  expect(overlay.inert).not.toBe(true);
});
it('honors autofocus and falls back to the close button or dialog', () => {
  last.tabIndex = -1;
  dialog.querySelector = () => last;
  openModal(); expect(doc.activeElement).toBe(last); closeModal();
  dialog.querySelector = () => null; dialog.querySelectorAll = () => [];
  openModal(); expect(doc.activeElement).toBe(last); closeModal();
  last.disabled = true;
  openModal(); expect(doc.activeElement).toBe(dialog);
});
it('wraps Tab and Shift+Tab and contains programmatic focus escapes', () => {
  openModal(); last.focus();
  expect(key('Tab').preventDefault).toHaveBeenCalled(); expect(doc.activeElement).toBe(first);
  expect(key('Tab', true).preventDefault).toHaveBeenCalled(); expect(doc.activeElement).toBe(last);
  trigger.focus(); handlers.get('focusin')?.(); expect(doc.activeElement).toBe(first);
});
it('closes with Escape, restores trigger and preserves edit cleanup', () => {
  store.currentEdit = {}; store.activeEditor = {};
  openModal(); key('Escape');
  expect(overlay.style.display).toBe('none'); expect(doc.activeElement).toBe(trigger);
  expect(background.inert).toBe(false); expect(store.currentEdit).toBe(null); expect(store.activeEditor).toBe(null);
  expect(handlers.size).toBe(0);
});
it('does not accumulate listeners or replace the trigger on repeated open', () => {
  openModal(); openModal();
  expect(doc.addEventListener).toHaveBeenCalledTimes(2);
  closeModal(); expect(doc.activeElement).toBe(trigger);
  openModal(); closeModal(); expect(handlers.size).toBe(0);
});
it('preserves prior inert state and skips a removed trigger', () => {
  background.inert = true;
  openModal(); trigger.isConnected = false; closeModal();
  expect(background.inert).toBe(true); expect(doc.activeElement).not.toBe(trigger);
});
it('releases restrictions on authoritative hiding and rescues focus after editor replacement', () => {
  openModal(); doc.activeElement = trigger; observer(); expect(doc.activeElement).toBe(first);
  overlay.style.display = 'none'; observer(); expect(background.inert).toBe(false); expect(handlers.size).toBe(0);
});
