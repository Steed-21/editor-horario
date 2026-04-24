import { store } from '../../state/store.js';
import { DF, CLOSE24 } from '../../config/constants.js';
import { cellHTML } from '../components/shiftPill.js';

export function renderDay() {
  const EMPLOYEES = store.EMPLOYEES;
  let h = '<table><thead><tr><th></th>';
  EMPLOYEES.forEach(e => h += `<th>${e.name.slice(0,5).toUpperCase()}</th>`);
  h += '</tr></thead><tbody>';
  
  for (let di = 0; di < 7; di++) {
    h += `<tr><td class="day-label">${DF[di].slice(0,3)}${CLOSE24.has(di) ? ' ★' : ''}</td>`;
    for (let pi = 0; pi < EMPLOYEES.length; pi++) {
      h += `<td>${cellHTML(pi, di)}</td>`;
    }
    h += '</tr>';
  }
  return h + '</tbody></table>';
}
