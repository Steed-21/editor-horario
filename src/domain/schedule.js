import { store } from '../state/store.js';
import { makeCell } from './cell.js';
import { CLOSE24, CLOSERS, OPENS9, NORMAL_PAT, TO2 } from '../config/constants.js';

export function getFreeDays() {
  return store.EMPLOYEES.map(e => e.freeDay);
}

function prevWD(d) { return d === 0 ? 6 : d - 1; }
function nextWD(d) { return d === 4 ? null : d + 1; }

export function buildWeek(wo) {
  const EMPLOYEES = store.EMPLOYEES;
  const n = EMPLOYEES.length;
  const freeDays = getFreeDays();
  const sched = EMPLOYEES.map((_, pi) => {
    const fd = freeDays[pi], pre = prevWD(fd), post = nextWD(fd);
    let ni = 0;
    return Array.from({length: 7}, (_, di) => {
      if(di === fd) return makeCell('OFF');
      if(di === pre) return makeCell('PRE');
      if(post !== null && di === post) return makeCell(CLOSE24.has(di) ? 'POSTF' : 'POST');
      const patId = NORMAL_PAT[(ni + (pi + wo)) % 4];
      ni++;
      if(patId === 'C') return makeCell(CLOSE24.has(di) ? 'CF' : 'C');
      return makeCell(patId);
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
        sched[nn.pi][di] = makeCell(CLOSE24.has(di) ? 'CF' : 'C');
        nn.cell = sched[nn.pi][di];
        closers++;
      }
      while(closers > 2) {
        const i = swappable.findIndex(x => CLOSERS.has(x.cell.id));
        if(i < 0) break;
        sched[swappable[i].pi][di] = makeCell('M');
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
        const p = cands[(di + wo) % cands.length];
        sched[p.pi][di] = makeCell((['T','S','M2'].includes(p.cell.id)) ? 'M' : 'W');
      }
    } else if (openers.length > 1) {
      const keep = (di + wo) % openers.length;
      openers.forEach((op, idx) => {
        if (idx !== keep && TO2[op.cell.id]) sched[op.pi][di] = makeCell(TO2[op.cell.id]);
      });
    }
  }
  return sched;
}

export function regenSchedule() {
  store.schedule = buildWeek(store.wo);
  store.edited = store.EMPLOYEES.map(() => Array(7).fill(false));
}
