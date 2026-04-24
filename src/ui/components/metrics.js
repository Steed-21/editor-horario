import { store } from '../../state/store.js';
import { validate } from '../../domain/validation.js';

export function renderMetrics() {
  const v = validate();
  const ec = store.edited.flat().filter(Boolean).length;
  const EMPLOYEES = store.EMPLOYEES;

  return `<div class="metric ${v.allH ? 'ok' : 'err'}">
    <div class="m-lbl">40h · semanales</div>
    <div class="m-val"><span class="status-dot ${v.allH ? 'dot-ok' : 'dot-err'}"></span>${v.allH ? 'OK' : 'FALLO'}</div>
    <div class="m-sub">${v.hours.filter(h => h === 40).length}/${EMPLOYEES.length} personas</div>
  </div>
  <div class="metric ${v.apertura_ok ? 'ok' : 'err'}">
    <div class="m-lbl">Apertura · 1 persona</div>
    <div class="m-val"><span class="status-dot ${v.apertura_ok ? 'dot-ok' : 'dot-err'}"></span>${v.apertura_ok ? 'OK' : 'FALLO'}</div>
    <div class="m-sub">${v.apertura_ok ? 'todos los días' : v.violations.filter(x => x.includes('apertura')).length + ' incidencias'}</div>
  </div>
  <div class="metric ${v.cierre_ok ? 'ok' : 'err'}">
    <div class="m-lbl">Cierre · 2 personas</div>
    <div class="m-val"><span class="status-dot ${v.cierre_ok ? 'dot-ok' : 'dot-err'}"></span>${v.cierre_ok ? 'OK' : 'FALLO'}</div>
    <div class="m-sub">${v.cierre_ok ? 'todos los días' : v.violations.filter(x => x.includes('cierre')).length + ' incidencias'}</div>
  </div>
  <div class="metric ${ec > 0 ? 'warn' : ''}">
    <div class="m-lbl">Ediciones · sesión</div>
    <div class="m-val"><span class="status-dot ${ec > 0 ? 'dot-warn' : ''}"></span>${ec}</div>
    <div class="m-sub">${ec === 0 ? 'sin cambios' : 'modificado'}</div>
  </div>`;
}
