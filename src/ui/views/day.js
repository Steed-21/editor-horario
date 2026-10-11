import { store, getWeekEmployees } from '../../state/store.js';
import { DF, CLOSE24 } from '../../config/constants.js';
import { cellHTML } from '../components/shiftPill.js';
import { esc } from '../../utils/escape.js';

export function renderDay() {
  const EMPLOYEES = getWeekEmployees();
  let h = '<table><thead><tr><th></th>';
  EMPLOYEES.forEach(e => h += `<th>${esc(String(e.name).slice(0,5).toUpperCase())}</th>`);
  h += '</tr></thead><tbody>';
  
  for (let di = 0; di < 7; di++) {
    h += `<tr><th scope="row" class="day-label">${DF[di].slice(0,3)} ${store.currentDates[di].str}${CLOSE24.has(di) ? ' ★' : ''}</th>`;
    for (let pi = 0; pi < EMPLOYEES.length; pi++) {
      h += `<td>${cellHTML(pi, di)}</td>`;
    }
    h += '</tr>';
  }
  return h + '</tbody></table>';
}
