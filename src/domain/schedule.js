import { store, getActiveEmployees, ensureRosterHistory } from '../state/store.js';
import { makeCell, cellHours } from './cell.js';
import { validateSchedule } from './validation.js';
import { CLOSE24, CLOSERS, OPENS9, NORMAL_PAT, TO2 } from '../config/constants.js';

export function getFreeDays() {
  return store.EMPLOYEES.map(e => e.freeDay);
}

function prevWD(d) { return d === 0 ? 6 : d - 1; }
function nextWD(d) { return d === 4 ? null : (d + 1) % 7; }

const modulo = (value, size) => ((value % size) + size) % size;

export function buildWeek(wo, EMPLOYEES = getActiveEmployees(), shifts = store.SH) {
  const required = ['OFF', 'PRE', 'PRE2', 'POST', 'POSTF', 'M', 'M2', 'W', 'W2', 'T', 'S', 'C', 'CF'];
  if (!Number.isSafeInteger(wo) || !Array.isArray(EMPLOYEES) || !EMPLOYEES.length
      || !EMPLOYEES.every(e => Number.isInteger(e.freeDay) && e.freeDay >= 0 && e.freeDay <= 6)
      || !required.every(id => {
        const sh = shifts?.[id];
        return sh && sh.id === id && Number.isFinite(sh.start) && Number.isFinite(sh.end)
          && sh.start >= 0 && sh.end <= 24 && sh.end >= sh.start
          && (sh.defaultBs == null || (Number.isFinite(sh.defaultBs) && sh.defaultBs >= sh.start
            && sh.defaultBs + (sh.defaultBd || 1) <= sh.end))
          && (sh.defaultBd == null || sh.defaultBd === 0.5 || sh.defaultBd === 1);
      })) throw new Error('Schedule generation failed: invalid inputs');
  const createCell = id => makeCell(id, undefined, undefined, shifts);
  const n = EMPLOYEES.length;
  const freeDays = EMPLOYEES.map(e => e.freeDay);
  const sched = EMPLOYEES.map((_, pi) => {
    const fd = freeDays[pi], pre = prevWD(fd), post = nextWD(fd);
    let ni = 0;
    return Array.from({length: 7}, (_, di) => {
      if(di === fd) return createCell('OFF');
      if(di === pre) return createCell('PRE');
      if(post !== null && di === post) return createCell(CLOSE24.has(di) ? 'POSTF' : 'POST');
      const patId = NORMAL_PAT[modulo(ni + pi + wo, 4)];
      ni++;
      if(patId === 'C') return createCell(CLOSE24.has(di) ? 'CF' : 'C');
      return createCell(patId);
    });
  });

  if (n >= 2) {
    for (let di = 0; di < 7; di++) {
      let closers = EMPLOYEES.reduce((a, _, pi) => a + (CLOSERS.has(sched[pi][di].id) ? 1 : 0), 0);
      const swappable = EMPLOYEES.map((_, pi) => ({pi, cell: sched[pi][di]}))
                                 .filter(x => !['OFF','PRE','PRE2','POST','POSTF'].includes(x.cell.id));
      while(closers < 2) {
        const nn = swappable.find(x => !CLOSERS.has(x.cell.id));
        if(!nn) break;
        sched[nn.pi][di] = createCell(CLOSE24.has(di) ? 'CF' : 'C');
        nn.cell = sched[nn.pi][di];
        closers++;
      }
      while(closers > 2) {
        const i = swappable.findIndex(x => CLOSERS.has(x.cell.id));
        if(i < 0) break;
        sched[swappable[i].pi][di] = createCell('M');
        swappable[i].cell = sched[swappable[i].pi][di];
        closers--;
      }
    }
  }

  for (let di = 0; di < 7; di++) {
    const openers = EMPLOYEES.map((_, pi) => ({pi, cell: sched[pi][di]})).filter(x => OPENS9.has(x.cell.id));
    if (openers.length === 0) {
      const cands = EMPLOYEES.map((_, pi) => ({pi, cell: sched[pi][di]}))
                             .filter(x => !['OFF','POST','POSTF','C','CF','PRE','PRE2'].includes(x.cell.id));
      if (cands.length > 0) {
        const p = cands[modulo(di + wo, cands.length)];
        sched[p.pi][di] = createCell((['T','S','M2'].includes(p.cell.id)) ? 'M' : 'W');
      }
    } else if (openers.length > 1) {
      const keep = modulo(di + wo, openers.length);
      openers.forEach((op, idx) => {
        if (idx !== keep && TO2[op.cell.id]) sched[op.pi][di] = createCell(TO2[op.cell.id]);
      });
    }
  }
  // Balance each row without changing opening/closing coverage or protected days.
  // Keep the least number of substitutions for each reachable hour total.
  const balanced = sched.map(row => {
    let states = new Map([[0, { cells: [], changes: 0 }]]);
    row.forEach((cell, di) => {
      const protectedCell = ['OFF', 'PRE', 'PRE2', 'POST', 'POSTF'].includes(cell.id);
      const closeH = CLOSE24.has(di) ? 24 : 23;
      const original = shifts[cell.id];
      const ids = protectedCell ? [cell.id] : [cell.id, ...['M', 'M2', 'W', 'W2', 'T', 'S', 'C', 'CF'].filter(id => id !== cell.id
        && (shifts[id].start === 9) === (original.start === 9)
        && (shifts[id].end === closeH) === (original.end === closeH))];
      const next = new Map();
      for (const [hours, state] of states) {
        for (const id of ids) {
          const candidate = createCell(id);
          const total = hours + cellHours(candidate, shifts);
          const changes = state.changes + (id !== cell.id ? 1 : 0);
          if (total <= 40 && (!next.has(total) || next.get(total).changes > changes)) {
            next.set(total, { cells: [...state.cells, candidate], changes });
          }
        }
      }
      states = next;
    });
    if (!states.has(40)) throw new Error('Schedule generation failed: cannot reach exactly 40 hours');
    return states.get(40).cells;
  });
  const result = validateSchedule(balanced, EMPLOYEES, shifts);
  if (!result.allH || !result.cierre_ok || !result.apertura_ok) {
    throw new Error(`Schedule generation failed: ${result.violations.join('; ')}`);
  }
  return balanced;
}

export function regenSchedule() {
  ensureRosterHistory();
  const roster = getActiveEmployees();
  store.schedule = buildWeek(store.wo, roster);
  store.scheduleRoster = structuredClone(roster);
  store.edited = roster.map(() => Array(7).fill(false));
  store.weekStatus = 'proposal';
  store.currentEdit = null;
  store.editorInvalidated = true;
}
