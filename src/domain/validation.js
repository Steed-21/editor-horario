import { store, getWeekEmployees } from '../state/store.js';
import { usableCell } from './shift.js';
import { cellHours } from './cell.js';
import { DF, CLOSE24 } from '../config/constants.js';

export function totalH(pi) {
  return store.schedule[pi].reduce((s, cell) => s + cellHours(cell), 0);
}

export function validate() {
  return validateSchedule(store.schedule, getWeekEmployees(), store.SH);
}

export function validateSchedule(schedule, EMPLOYEES, shifts) {
  if (!Array.isArray(schedule) || !EMPLOYEES.length || schedule.length !== EMPLOYEES.length
      || !schedule.every(row => Array.isArray(row) && row.length === 7
        && row.every(cell => usableCell(cell, shifts)))) {
    return { hours: [], allH: false, cierre_ok: false, apertura_ok: false, violations: ['Horario incompleto o referencias inválidas'] };
  }
  
  const hours = schedule.map(row => row.reduce((sum, cell) => sum + cellHours(cell, shifts), 0));
  const allH = hours.every(h => h === 40);
  const violations = [];
  hours.forEach((h, pi) => { if (h !== 40) violations.push(`Persona ${pi + 1}: ${h}h (requeridas: 40h)`); });
  let cierre_ok = true, apertura_ok = true;

  for (let di = 0; di < 7; di++) {
    const closeH = CLOSE24.has(di) ? 24 : 23;
    let cl = 0;
    let op = 0;
    
    for (let pi = 0; pi < EMPLOYEES.length; pi++) {
      const cell = schedule[pi][di];
      const sh = shifts[cell.id];
      if (sh && sh.id !== 'OFF') {
        if (sh.end === closeH) cl++;
        if (sh.start === 9) op++;
      }
    }
    
    if (cl !== 2) {
      cierre_ok = false;
      violations.push(`${DF[di]}: cierre=${cl}`);
    }
    if (op !== 1) {
      apertura_ok = false;
      violations.push(`${DF[di]}: apertura=${op}`);
    }
  }
  return { hours, allH, cierre_ok, apertura_ok, violations };
}
