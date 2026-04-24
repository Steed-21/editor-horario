import { store, saveState } from '../state/store.js';
import { renderPerson } from './views/person.js';
import { renderDay } from './views/day.js';
import { renderHours } from './views/hours.js';
import { renderCover } from './views/cover.js';
import { renderMetrics } from './components/metrics.js';
import { renderLegend } from './components/legend.js';
import { getDatesForWeek } from '../domain/dateUtils.js';

export function render() {
  store.currentDates = getDatesForWeek(store.baseDate, store.wo);
  
  const wLabel = document.getElementById('wLabel');
  if (wLabel) wLabel.textContent = `${store.currentDates[0].str} - ${store.currentDates[6].str}`;
  
  const dp = document.getElementById('datePicker');
  if (dp) {
    const monday = new Date(store.baseDate);
    monday.setDate(monday.getDate() + (store.wo * 7));
    dp.value = monday.toISOString().split('T')[0];
  }
  
  const subtitleTxt = document.getElementById('subtitleTxt');
  if (subtitleTxt) subtitleTxt.textContent = `tienda · ${store.EMPLOYEES.length} persona${store.EMPLOYEES.length === 1 ? '' : 's'} · v5.1.0`;
  
  const c = document.getElementById('tContainer');
  if (c) {
    if (store.EMPLOYEES.length === 0) {
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
  if (metricsSide) metricsSide.innerHTML = renderMetrics();

  const legendBlock = document.getElementById('legendBlock');
  if (legendBlock) legendBlock.innerHTML = renderLegend();

  const actions = document.querySelector('.actions');
  if (actions) actions.style.display = store.isAdmin ? 'flex' : 'none';
  
  saveState();
}
