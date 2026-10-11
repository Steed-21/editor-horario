import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
vi.mock('../services/firebase.js', () => ({ db: {}, ref: vi.fn(), onValue: vi.fn(), set: vi.fn() }));
import { store } from '../state/store.js';
import { DEFAULT_SHIFTS } from '../config/shifts.js';
import { renderPerson } from './views/person.js';
import { renderDay } from './views/day.js';
import { renderHours } from './views/hours.js';
import { renderCover } from './views/cover.js';
import { render } from './layout.js';

const markup = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles/main.css', import.meta.url), 'utf8');
function luminance(hex) {
  const value = hex.slice(1);
  const full = value.length === 3 ? [...value].map(c => c + c).join('') : value;
  return [0.2126, 0.7152, 0.0722].reduce((sum, weight, i) => {
    const channel = parseInt(full.slice(i * 2, i * 2 + 2), 16) / 255;
    return sum + weight * (channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
  }, 0);
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((a, b) => a - b);
  return (values[1] + .05) / (values[0] + .05);
}
it.each(['off', '7h', '8h', '6h', 'other'])('keeps semantic %s foreground at readable small-text contrast', type => {
  const background = css.match(new RegExp(`\\.border-${type}\\s*\\{[^}]*background-color:\\s*(#[a-f0-9]+)`, 'i'))[1];
  const dark = css.match(/\.container \.shift-pill:is\([^\n]+color:\s*(#[a-f0-9]+)/i)[1];
  const light = css.match(/\.shift-pill\s*\{[^}]*color:\s*(#[a-f0-9]+)/i)[1];
  expect(contrast(['off', '7h', '8h'].includes(type) ? dark : light, background)).toBeGreaterThanOrEqual(4.5);
});
it.each([0, 1])('keeps authenticated muted labels readable on theme %s surfaces', theme => {
  const muted = [...css.matchAll(/\.container\s*\{\s*--text-tertiary:\s*(#[a-f0-9]+)/gi)][theme][1];
  const surfaces = [...css.matchAll(/:root\{--bg-primary:(#[a-f0-9]+);--bg-secondary:(#[a-f0-9]+);--bg-tertiary:(#[a-f0-9]+)/gi)][theme];
  for (const background of surfaces.slice(1)) expect(contrast(muted, background)).toBeGreaterThanOrEqual(4.5);
});
it('names the date input, scroll region and modal without adding fake tab semantics', () => {
  expect(markup).toMatch(/<label for="datePicker" class="sr-only">[^<]+<\/label>/);
  expect(markup).toMatch(/id="tContainer"[^>]*role="region"[^>]*tabindex="0"[^>]*aria-label="Horario semanal — desplazamiento horizontal"/);
  expect(markup).toMatch(/id="modalBox"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="modalTitle"/);
  expect(markup).not.toMatch(/role="tab(list)?"/);
});

function setup() {
  store.SH = structuredClone(DEFAULT_SHIFTS);
  store.EMPLOYEES = [{ id: 'synthetic', name: 'Persona', freeDay: 0 }];
  store.schedule = [Array.from({ length: 7 }, () => ({ id: 'OFF', bs: null, bd: 1 }))];
  store.edited = [Array(7).fill(false)];
  store.currentDates = Array.from({ length: 7 }, () => ({ str: '11/05' }));
  store.isAdmin = false;
  store.weekStatus = 'persisted';
  store.readerStatus = 'listener';
  store.editorInvalidated = false;
  store.weekRosters = {};
}
it.each([renderPerson, renderDay, renderHours, renderCover])('identifies row labels as headers in %s', renderer => {
  setup();
  const html = renderer();
  expect(html).toMatch(/<th scope="row" class="(name-cell|day-label)">/);
  expect(html).not.toMatch(/<td class="(name-cell|day-label)">/);
});
it('reflects every selected view with exactly one pressed button on rendering', () => {
  setup();
  const tabs = ['person', 'day', 'cover', 'hours'].map(view => ({ dataset: { view }, attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } }));
  vi.stubGlobal('document', { querySelectorAll: () => tabs, querySelector: () => null, getElementById: () => null });
  for (const view of ['person', 'hours', 'day', 'cover']) {
    store.view = view;
    render();
    expect(tabs.filter(t => t.attributes['aria-pressed'] === 'true').map(t => t.dataset.view)).toEqual([view]);
    expect(tabs.filter(t => t.dataset.view !== view).every(t => t.attributes['aria-pressed'] === 'false')).toBe(true);
  }
  vi.unstubAllGlobals();
});
