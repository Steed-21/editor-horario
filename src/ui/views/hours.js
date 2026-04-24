import { store } from '../../state/store.js';
import { DS } from '../../config/constants.js';
import { cellHours } from '../../domain/cell.js';

export function renderHours() {
  const EMPLOYEES = store.EMPLOYEES;
  let h = '<table><thead><tr><th></th>';
  DS.forEach((d, i) => h += `<th class="${i===4 ? 'vie' : i===5 ? 'sab' : ''}">${d} ${store.currentDates[i].str}</th>`);
  h += '<th>Σh</th></tr></thead><tbody>';
  
  EMPLOYEES.forEach((e, pi) => {
    let tot = 0;
    h += `<tr><td class="name-cell">${e.name}</td>`;
    for (let di = 0; di < 7; di++) {
      const hh = cellHours(store.schedule[pi][di]);
      tot += hh;
      const col = hh === 0 ? '#1D9E75' : hh === 8 ? '#378ADD' : hh === 7 ? '#BA7517' : hh === 6 ? '#A32D2D' : '#5F5E5A';
      h += `<td style="padding:6px 4px;font-size:11px;font-weight:500;color:${col};background:var(--bg-primary)">${hh > 0 ? hh + 'h' : '–'}</td>`;
    }
    h += `<td class="total-cell ${tot === 40 ? 'ok' : 'err'}">${tot}h</td></tr>`;
  });
  
  return h + '</tbody></table>';
}
