import { expect, it, vi } from 'vitest';
import { renderStatusRail, statusItems } from './statusRail.js';

it.each([
  ['loading', 'cargando'], ['cached', 'caché local sin verificar'],
  ['listener', 'datos del listener; servidor sin verificar'],
  ['pending', 'guardado pendiente; propuesta local'],
  ['persisted', 'escritura confirmada'], ['failed', 'guardado/sincronización fallido'],
  ['unknown', 'estado local sin verificar']
])('preserves %s persistence meaning', (persistenceStatus, text) => {
  const items = statusItems({ persistenceStatus });
  expect(items).toEqual([{ kind: persistenceStatus === 'unknown' ? 'local' : persistenceStatus, text }]);
  if (persistenceStatus !== 'persisted') expect(items.map(i => i.text).join(' ')).not.toContain('confirmada');
});
it.each([
  ['missing', 'semana ausente / no publicada'], ['proposal', 'propuesta local'],
  ['legacy', 'histórico inconsistente / solo lectura'], ['invalid', 'datos inválidos']
])('preserves %s week meaning alongside persistence', (weekStatus, text) => {
  const items = statusItems({ persistenceStatus: 'listener', weekStatus });
  expect(items[0].text).toContain('servidor sin verificar');
  expect(items[1].text).toContain(text);
});
it('preserves partial, inherited and error information without interpreting errors as HTML', () => {
  const input = { persistenceStatus: 'failed', partialCatalog: true, inheritedAttribution: true, writeError: '<img src=x onerror=bad>' };
  expect(statusItems(input).map(i => i.text)).toEqual([
    'guardado/sincronización fallido', 'catálogo parcial: turnos inválidos',
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
  let markup = '', writes = 0;
  const rail = { get innerHTML() { return markup; }, set innerHTML(value) { writes++; markup = value; }, setAttribute: vi.fn() };
  vi.stubGlobal('document', { getElementById: () => rail });
  renderStatusRail({ persistenceStatus: 'persisted' });
  renderStatusRail({ persistenceStatus: 'persisted' });
  expect(writes).toBe(1);
  vi.unstubAllGlobals();
});
