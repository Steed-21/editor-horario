import { store } from '../../state/store.js';
import { cellHours, borderClass, cellLabel } from '../../domain/cell.js';

export function cellHTML(pi, di) {
  const cell = store.schedule[pi][di];
  const sh = store.SH[cell.id];
  const bk = cell.bs !== null 
    ? `<span class="bk-label">⏸${cell.bs}–${cell.bs+1}</span>`
    : (sh.id !== 'OFF' && !['PRE','PRE2','POST','POSTF','S'].includes(sh.id) && cellHours(cell) >= 7 ? `<span class="bk-label" style="color:#BA7517">sin ⏸</span>` : '');
  const ec = store.edited[pi][di] ? ' edited' : '';
  
  return `<button class="shift-pill ${sh.cls}${ec} ${borderClass(cell)}" onclick="window.openCellEditor(${pi},${di})">${cellLabel(cell)}${bk}</button>`;
}
