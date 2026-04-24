import { store } from '../state/store.js';
import { cellHours } from './cell.js';
import { CLOSERS, OPENS9, DF } from '../config/constants.js';

export function totalH(pi) {
  return store.schedule[pi].reduce((s, cell) => s + cellHours(cell), 0);
}

export function validate() {
  const EMPLOYEES = store.EMPLOYEES;
  const schedule = store.schedule;
  
  const hours = EMPLOYEES.map((_, pi) => totalH(pi));
  const allH = hours.every(h => h === 40);
  const violations = [];
  let cierre_ok = true, apertura_ok = true;

  for (let di = 0; di < 7; di++) {
    const cl = EMPLOYEES.reduce((a, _, pi) => a + (CLOSERS.has(schedule[pi][di].id) ? 1 : 0), 0);
    if (cl !== 2) {
      cierre_ok = false;
      violations.push(`${DF[di]}: cierre=${cl}`);
    }
    const op = EMPLOYEES.reduce((a, _, pi) => a + (OPENS9.has(schedule[pi][di].id) ? 1 : 0), 0);
    if (op !== 1) {
      apertura_ok = false;
      violations.push(`${DF[di]}: apertura=${op}`);
    }
  }
  return { hours, allH, cierre_ok, apertura_ok, violations };
}
