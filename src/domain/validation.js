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
    const closeH = CLOSE24.has(di) ? 24 : 23;
    let cl = 0;
    let op = 0;
    
    for (let pi = 0; pi < EMPLOYEES.length; pi++) {
      const cell = schedule[pi][di];
      const sh = store.SH[cell.id];
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
