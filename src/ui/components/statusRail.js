import { esc } from '../../utils/escape.js';

const persistenceLabels = {
  loading: 'Cargando…', cached: 'Datos locales',
  pending: 'Guardando…', persisted: 'Guardado', failed: 'Error al guardar'
};
let presentation;

export function statusItems({ persistenceStatus, weekStatus, partialCatalog, inheritedAttribution, writeError }) {
  const items = Object.hasOwn(persistenceLabels, persistenceStatus)
    ? [{ kind: persistenceStatus, text: persistenceLabels[persistenceStatus] }] : [];
  if (partialCatalog) items.push({ kind: 'warning', text: 'catálogo parcial: turnos inválidos' });
  if (weekStatus === 'legacy') items.push({ kind: 'warning', text: 'histórico inconsistente / solo lectura' });
  if (weekStatus === 'invalid') items.push({ kind: 'failed', text: 'Horario no disponible: datos inválidos.' });
  if (inheritedAttribution) items.push({ kind: 'warning', text: 'atribución heredada observada; original sin verificar' });
  if (weekStatus === 'proposal') items.push({ kind: 'local', text: 'propuesta local' });
  if (weekStatus === 'missing') items.push({ kind: 'local', text: 'semana ausente / no publicada' });
  if (writeError) items.push({ kind: 'failed', text: writeError });
  return items;
}

function paintRail(state) {
  const items = statusItems(state.input).filter(item => item.kind !== 'persisted' || state.successVisible);
  state.markup = items.map(item => `<span class="state-chip state-${item.kind}">${esc(item.text)}</span>`).join('');
  if (state.rail.innerHTML !== state.markup) state.rail.innerHTML = state.markup;
  state.rail.setAttribute?.('data-persistence', state.input.persistenceStatus);
}

export function renderStatusRail(input) {
  const rail = document.getElementById('statusRail');
  if (!rail || presentation?.rail !== rail || presentation?.input.persistenceStatus !== input.persistenceStatus) {
    clearTimeout(presentation?.timer);
    presentation = rail ? { rail, input: { ...input }, successVisible: input.persistenceStatus === 'persisted' } : undefined;
    if (presentation?.successVisible) {
      const state = presentation;
      state.timer = setTimeout(() => {
        state.timer = undefined;
        state.successVisible = false;
        // A reader transition or a replaced rail must not receive delayed admin output.
        if (presentation !== state || typeof document === 'undefined' || document.getElementById('statusRail') !== rail
          || rail.innerHTML !== state.markup
          || (rail.getAttribute && rail.getAttribute('data-persistence') !== 'persisted')) return;
        paintRail(state);
      }, 1500);
    }
  }
  if (!rail) return;
  presentation.input = { ...input };
  paintRail(presentation);
}
