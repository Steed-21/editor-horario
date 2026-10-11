import { store } from '../../state/store.js';
import { cellHours, borderClass, cellLabel } from '../../domain/cell.js';
import { formatHour } from '../../domain/dateUtils.js';
import { esc } from '../../utils/escape.js';

export function cellHTML(pi, di) {
  const cell = store.schedule[pi][di];
  const sh = store.SH[cell.id];
  let bk = '';
  if (cell.bs != null) {
    const bd = cell.bd || 1;
    bk = `<span class="bk-label">⏸${formatHour(cell.bs)}–${formatHour(cell.bs + bd)}</span>`;
  } else if (sh.id !== 'OFF' && !['PRE','PRE2','POST','POSTF','S'].includes(sh.id) && cellHours(cell) >= 7) {
    bk = `<span class="bk-label" style="color:#FFD700">sin ⏸</span>`;
  }
  const ec = store.isAdmin && store.edited[pi][di] ? ' edited' : '';
  
  if (!store.isAdmin) return `<span class="shift-pill reader-shift ${esc(sh.cls)} ${borderClass(cell)}">${esc(cellLabel(cell))}${bk}</span>`;
  const oc = store.isAdmin ? `onclick="window.openCellEditor(${pi},${di})"` : '';
  return `<button class="shift-pill ${esc(sh.cls)}${ec} ${borderClass(cell)}" ${oc}>${esc(cellLabel(cell))}${bk}</button>`;
}
