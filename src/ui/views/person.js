import { store } from '../../state/store.js';
import { DS } from '../../config/constants.js';
import { totalH } from '../../domain/validation.js';
import { cellHTML } from '../components/shiftPill.js';

export function renderPerson() {
  const EMPLOYEES = store.EMPLOYEES;
  let h = '<table><thead><tr><th></th>';
  DS.forEach((d, i) => h += `<th class="${i===4 ? 'vie' : i===5 ? 'sab' : ''}">${d} ${store.currentDates[i].str}</th>`);
  h += '<th>Σh</th></tr></thead><tbody>';
  
  EMPLOYEES.forEach((e, pi) => {
    const tot = totalH(pi);
    h += `<tr><td class="name-cell">${e.name}</td>`;
    for (let di = 0; di < 7; di++) {
      h += `<td>${cellHTML(pi, di)}</td>`;
    }
    h += `<td class="total-cell ${tot === 40 ? 'ok' : 'err'}">${tot}h</td></tr>`;
  });
  
  return h + '</tbody></table>';
}
