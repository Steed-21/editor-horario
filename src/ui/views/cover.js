import { store } from '../../state/store.js';
import { DS, CLOSE24 } from '../../config/constants.js';

export function renderCover() {
  const EMPLOYEES = store.EMPLOYEES;
  const SH = store.SH;
  const schedule = store.schedule;
  
  let h = '<table><thead><tr><th></th>';
  DS.forEach((d, i) => h += `<th class="${i===4 ? 'vie' : i===5 ? 'sab' : ''}">${d} ${store.currentDates[i].str}</th>`);
  h += '</tr></thead><tbody>';
  
  for (let hr = 9; hr <= 23; hr++) {
    h += `<tr><td class="day-label">${hr}h</td>`;
    for (let di = 0; di < 7; di++) {
      const closeH = CLOSE24.has(di) ? 24 : 23;
      const isClose = hr >= (closeH - 2);
      const isOpen = hr === 9;
      let active = 0, onBreak = 0;
      
      for (let pi = 0; pi < EMPLOYEES.length; pi++) {
        const cell = schedule[pi][di];
        const sh = SH[cell.id];
        if (!sh || sh.id === 'OFF') continue;
        
        const shiftIntersectStart = Math.max(hr, sh.start);
        const shiftIntersectEnd = Math.min(hr + 1, sh.end);
        let shiftOverlap = Math.max(0, shiftIntersectEnd - shiftIntersectStart);
        
        if (shiftOverlap > 0) {
          let breakOverlap = 0;
          if (cell.bs != null) {
            const brkEnd = cell.bs + (cell.bd || 1);
            const brkIntersectStart = Math.max(hr, cell.bs);
            const brkIntersectEnd = Math.min(hr + 1, brkEnd);
            breakOverlap = Math.max(0, brkIntersectEnd - brkIntersectStart);
          }
          active += (shiftOverlap - breakOverlap);
          onBreak += breakOverlap;
        }
      }
      
      const total = active + onBreak;
      let bg = 'var(--bg-primary)', tc = 'var(--text-tertiary)';
      if (total > 0) {
        if (isClose) {
          bg = active === 2 ? '#E1F5EE' : active < 2 ? '#FCEBEB' : '#FAEEDA';
          tc = active === 2 ? '#0F6E56' : active < 2 ? '#A32D2D' : '#854F0B';
        } else if (isOpen) {
          bg = active === 1 ? '#E1F5EE' : active === 0 ? '#FCEBEB' : '#FAEEDA';
          tc = active === 1 ? '#0F6E56' : active === 0 ? '#A32D2D' : '#854F0B';
        } else {
          bg = active < 2 ? '#FAEEDA' : active >= 4 ? '#E1F5EE' : '#E6F1FB';
          tc = active < 2 ? '#854F0B' : active >= 4 ? '#0F6E56' : '#185FA5';
        }
      }
      
      const bkL = onBreak > 0 ? `<span style="font-size:8px;color:#BA7517"> +${onBreak}⏸</span>` : '';
      h += `<td style="padding:5px 3px;background:${bg};font-size:10px;font-weight:500;color:${tc}">${total > 0 ? active + bkL : '–'}</td>`;
    }
    h += '</tr>';
  }
  return h + '</tbody></table>';
}
