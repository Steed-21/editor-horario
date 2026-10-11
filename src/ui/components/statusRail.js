import { esc } from '../../utils/escape.js';

const persistenceLabels = {
  loading: 'cargando', cached: 'caché local sin verificar',
  listener: 'datos del listener; servidor sin verificar',
  pending: 'guardado pendiente; propuesta local', persisted: 'escritura confirmada',
  failed: 'guardado/sincronización fallido'
};

export function statusItems({ persistenceStatus, weekStatus, partialCatalog, inheritedAttribution, writeError }) {
  const kind = Object.hasOwn(persistenceLabels, persistenceStatus) ? persistenceStatus : 'local';
  const items = [{ kind, text: persistenceLabels[kind] || 'estado local sin verificar' }];
  if (partialCatalog) items.push({ kind: 'warning', text: 'catálogo parcial: turnos inválidos' });
  if (weekStatus === 'legacy') items.push({ kind: 'warning', text: 'histórico inconsistente / solo lectura' });
  if (weekStatus === 'invalid') items.push({ kind: 'failed', text: 'Horario no disponible: datos inválidos.' });
  if (inheritedAttribution) items.push({ kind: 'warning', text: 'atribución heredada observada; original sin verificar' });
  if (weekStatus === 'proposal') items.push({ kind: 'local', text: 'propuesta local' });
  if (weekStatus === 'missing') items.push({ kind: 'local', text: 'semana ausente / no publicada' });
  if (writeError) items.push({ kind: 'failed', text: writeError });
  return items;
}

export function renderStatusRail(input) {
  const rail = document.getElementById('statusRail');
  if (!rail) return;
  const items = statusItems(input);
  const markup = items.map(item => `<span class="state-chip state-${item.kind}">${esc(item.text)}</span>`).join('');
  // Keep identical deliveries quiet; the stable rail owns acknowledgement motion.
  if (rail.innerHTML !== markup) rail.innerHTML = markup;
  rail.setAttribute?.('data-persistence', items[0].kind);
}
