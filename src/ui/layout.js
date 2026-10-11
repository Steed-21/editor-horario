import { store, getCurrentWeekStr, getWeekEmployees } from '../state/store.js';
import { usableShift } from '../domain/shift.js';
import { esc } from '../utils/escape.js';
import { DS } from '../config/constants.js';
import { renderPerson } from './views/person.js';
import { renderDay } from './views/day.js';
import { renderHours } from './views/hours.js';
import { renderCover } from './views/cover.js';
import { renderMetrics } from './components/metrics.js';
import { renderLegend } from './components/legend.js';
import { getDatesForWeek } from '../domain/dateUtils.js';
import { renderStatusRail } from './components/statusRail.js';
import { renderLog } from './components/log.js';

function renderLegacyWeek() {
  const week = store.weeks[getCurrentWeekStr()];
  const heading = '<div class="info-box">Semana heredada inconsistente · solo lectura. Horas no disponibles.</div>';
  const header = DS.map((day, di) => `<th>${esc(day)} ${esc(store.currentDates[di].str)}</th>`).join('');
  const rows = week.schedule.map((row, pi) => `<tr><td class="name-cell">${esc(getWeekEmployees()[pi]?.name ?? `Fila ${pi + 1}`)}</td>${row.map(cell =>
    `<td>${Object.hasOwn(store.SH, cell.id) ? esc(cell.id) : `Sin definición: ${esc(cell.id)}`}</td>`).join('')}</tr>`).join('');
  return `${heading}<table><thead><tr><th></th>${header}</tr></thead><tbody>${rows}</tbody></table>`;
}

export function render() {
  store.currentDates = getDatesForWeek(getCurrentWeekStr(), 0);
  
  const wLabel = document.getElementById('wLabel');
  if (wLabel) wLabel.textContent = `${store.currentDates[0].str} - ${store.currentDates[6].str}`;
  
  const dp = document.getElementById('datePicker');
  if (dp) {
    dp.value = getCurrentWeekStr();
  }
  
  const subtitleTxt = document.getElementById('subtitleTxt');
  const employeeCount = store.weekStatus === 'legacy' ? store.weeks[getCurrentWeekStr()].schedule.length
    : store.schedule.length ? getWeekEmployees().length : store.EMPLOYEES.length;
  if (subtitleTxt) subtitleTxt.textContent = `tienda · ${employeeCount} persona${employeeCount === 1 ? '' : 's'} · v5.1.0`;
  
  const c = document.getElementById('tContainer');
  if (c) {
    if (!store.isAdmin && store.readerStatus === 'failed') {
      c.textContent = 'No se pudo cargar el horario. Vuelve a iniciar sesión.';
    } else if (store.weekStatus === 'legacy') {
      c.innerHTML = renderLegacyWeek();
    } else if (store.schedule.length === 0) {
      c.textContent = store.weekStatus === 'invalid' ? 'Horario no disponible: datos inválidos.'
        : store.persistenceStatus === 'loading' ? 'Cargando horario…'
        : 'Sin horario guardado para esta semana.';
    } else if (store.isAdmin && store.EMPLOYEES.length === 0) {
      c.innerHTML = '<div style="padding:2rem;text-align:center;font-size:11px;color:var(--text-tertiary)">Sin empleados. Añade al menos uno desde "Empleados".</div>';
    } else if (store.view === 'person') {
      c.innerHTML = renderPerson();
    } else if (store.view === 'day') {
      c.innerHTML = renderDay();
    } else if (store.view === 'cover') {
      c.innerHTML = renderCover();
    } else {
      c.innerHTML = renderHours();
    }
  }

  const metricsSide = document.getElementById('metricsSide');
  if (metricsSide) metricsSide.innerHTML = store.schedule.length ? renderMetrics() : '';

  const legendBlock = document.getElementById('legendBlock');
  if (legendBlock) legendBlock.innerHTML = renderLegend();

  const actions = document.querySelector('.actions');
  if (actions) actions.style.display = store.isAdmin ? 'flex' : 'none';
  const create = document.getElementById('bCreateWeek');
  if (create) {
    create.hidden = !store.isAdmin || store.weekStatus !== 'missing';
    create.disabled = store.pendingWrite != null || store.persistenceStatus === 'loading';
  }
  const confirm = document.getElementById('bLock');
  if (confirm) confirm.disabled = store.schedule.length === 0;
  const modal = document.getElementById('modalBg');
  if (modal && store.editorInvalidated) {
    modal.style.display = 'none';
    store.editorInvalidated = false;
  }
  if (store.isAdmin) renderStatusRail({
    persistenceStatus: store.persistenceStatus,
    weekStatus: store.weekStatus,
    partialCatalog: Object.entries(store.SH).some(([id, sh]) => !usableShift(id, sh)),
    inheritedAttribution: getWeekEmployees().some(e => e?.attribution === 'legacy-observed'),
    writeError: store.writeError
  });
  else {
    const rail = document.getElementById('statusRail');
    if (rail) {
      rail.textContent = store.readerStatus === 'loading' ? 'SOLO LECTURA · Cargando horario…'
        : store.readerStatus === 'failed' ? 'SOLO LECTURA · Horario no disponible' : 'SOLO LECTURA';
      rail.removeAttribute?.('data-persistence');
    }
  }
  renderLog();
}
