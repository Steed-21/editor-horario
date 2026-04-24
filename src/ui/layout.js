import { store } from '../state/store.js';
import { renderPerson } from './views/person.js';
import { renderDay } from './views/day.js';
import { renderHours } from './views/hours.js';
import { renderCover } from './views/cover.js';
import { renderMetrics } from './components/metrics.js';
import { renderLegend } from './components/legend.js';

export function render() {
  const wLabel = document.getElementById('wLabel');
  if (wLabel) wLabel.textContent = `SEMANA_${store.wo + 1}`;
  
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
}
