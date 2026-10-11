import { afterEach, expect, it, vi } from 'vitest';
import { renderStatusRail, statusItems } from './statusRail.js';

afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it.each([
  ['loading', 'Cargando…'], ['cached', 'Datos locales'],
  ['pending', 'Guardando…'], ['persisted', 'Guardado'], ['failed', 'Error al guardar']
])('presents %s without changing the internal status', (persistenceStatus, text) => {
  const input = { persistenceStatus };
  expect(statusItems(input)).toEqual([{ kind: persistenceStatus, text }]);
  expect(input.persistenceStatus).toBe(persistenceStatus);
});
it.each(['listener', 'unknown'])('hides internal %s wording', persistenceStatus => {
  expect(statusItems({ persistenceStatus })).toEqual([]);
});
it.each([
  ['missing', 'semana ausente / no publicada'], ['proposal', 'propuesta local'],
  ['legacy', 'histórico inconsistente / solo lectura'], ['invalid', 'datos inválidos']
])('preserves %s week meaning alongside persistence', (weekStatus, text) => {
  const items = statusItems({ persistenceStatus: 'listener', weekStatus });
  expect(items).toHaveLength(1);
  expect(items[0].text).toContain(text);
});
it('preserves partial, inherited and error information without interpreting errors as HTML', () => {
  const input = { persistenceStatus: 'failed', partialCatalog: true, inheritedAttribution: true, writeError: '<img src=x onerror=bad>' };
  expect(statusItems(input).map(i => i.text)).toEqual([
    'Error al guardar', 'catálogo parcial: turnos inválidos',
    'atribución heredada observada; original sin verificar', input.writeError
  ]);
  const rail = { innerHTML: '', setAttribute: vi.fn() };
  vi.stubGlobal('document', { getElementById: () => rail });
  renderStatusRail(input);
  expect(rail.innerHTML).toContain('&lt;img'); expect(rail.innerHTML).not.toContain('<img');
  expect(rail.setAttribute).toHaveBeenCalledWith('data-persistence', 'failed');
  vi.unstubAllGlobals();
});
it('does not replace identical rail content on repeated render deliveries', () => {
  vi.useFakeTimers();
  let markup = '', writes = 0;
  const rail = { get innerHTML() { return markup; }, set innerHTML(value) { writes++; markup = value; }, setAttribute: vi.fn() };
  vi.stubGlobal('document', { getElementById: () => rail });
  renderStatusRail({ persistenceStatus: 'persisted' });
  renderStatusRail({ persistenceStatus: 'persisted' });
  expect(writes).toBe(1);
  vi.unstubAllGlobals();
});

function mountRail() {
  vi.useFakeTimers();
  const attributes = new Map();
  const rail = { innerHTML: '', setAttribute: (key, value) => attributes.set(key, value),
    getAttribute: key => attributes.get(key), removeAttribute: key => attributes.delete(key) };
  vi.stubGlobal('document', { getElementById: () => rail });
  return rail;
}
it('clears success after 1500ms while preserving the latest operational warnings', () => {
  const rail = mountRail();
  renderStatusRail({ persistenceStatus: 'persisted' });
  vi.advanceTimersByTime(1000);
  renderStatusRail({ persistenceStatus: 'persisted', weekStatus: 'legacy', partialCatalog: true,
    inheritedAttribution: true, writeError: 'Operational error' });
  expect(vi.getTimerCount()).toBe(1);
  expect(rail.innerHTML).toContain('Guardado');
  vi.advanceTimersByTime(500);
  expect(rail.innerHTML).not.toContain('Guardado');
  for (const text of ['histórico inconsistente', 'catálogo parcial', 'atribución heredada', 'Operational error']) {
    expect(rail.innerHTML).toContain(text);
  }
  renderStatusRail({ persistenceStatus: 'persisted', weekStatus: 'missing' });
  expect(rail.innerHTML).not.toContain('Guardado');
  expect(rail.innerHTML).toContain('semana ausente');
  expect(vi.getTimerCount()).toBe(0);
});
it.each([['pending', 'Guardando…'], ['failed', 'Error al guardar']])('immediately supersedes success with %s', (persistenceStatus, text) => {
  const rail = mountRail();
  renderStatusRail({ persistenceStatus: 'persisted' });
  renderStatusRail({ persistenceStatus });
  expect(vi.getTimerCount()).toBe(0);
  vi.advanceTimersByTime(2000);
  expect(rail.innerHTML).toContain(text);
  expect(rail.innerHTML).not.toContain('Guardado');
  renderStatusRail({ persistenceStatus: 'persisted' });
  expect(rail.innerHTML).toContain('Guardado');
  expect(vi.getTimerCount()).toBe(1);
});
it('does not overwrite the reader rail after a role transition', () => {
  const rail = mountRail();
  renderStatusRail({ persistenceStatus: 'persisted' });
  rail.innerHTML = 'SOLO LECTURA';
  rail.removeAttribute('data-persistence');
  vi.advanceTimersByTime(1500);
  expect(rail.innerHTML).toBe('SOLO LECTURA');
});
it('does not update a removed rail and reuses one timer for its replacement', () => {
  const previous = mountRail();
  renderStatusRail({ persistenceStatus: 'persisted' });
  const replacement = { innerHTML: '', setAttribute: vi.fn() };
  vi.stubGlobal('document', { getElementById: () => replacement });
  renderStatusRail({ persistenceStatus: 'persisted' });
  expect(vi.getTimerCount()).toBe(1);
  vi.advanceTimersByTime(1500);
  expect(previous.innerHTML).toContain('Guardado');
  expect(replacement.innerHTML).toBe('');
});
