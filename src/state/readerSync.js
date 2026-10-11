import { store, getCurrentWeekStr, weekShape, clearSessionState, clearAdminCache, invalidateEditor } from './store.js';
import { usableRoster } from '../domain/roster.js';
import { usableCell } from '../domain/shift.js';
import { db, ref, onValue } from '../services/firebase.js';

let readerEpoch = 0;
// Readers own only SH and two selected-week paths; no root snapshot or cache hydration.
export function syncReader(callback) {
  const epoch = ++readerEpoch;
  let active = true;
  let generation = 0;
  let shiftReady = false;
  let shiftFailed = false;
  let weekFailed = false;
  let weekStops = [];
  let shiftStop;
  let receivedSchedule = false;
  let receivedRoster = false;
  let rawSchedule;
  let rawRoster;
  clearAdminCache();
  clearSessionState();
  const current = () => active && epoch === readerEpoch;
  const render = () => { if (callback) callback(); else window._renderUI?.(); };
  const clearWeek = () => {
    store.weeks = {}; store.weekRosters = {}; store.scheduleRoster = [];
    store.schedule = []; store.edited = []; store.weekStatus = 'missing';
  };
  const update = () => {
    if (!current()) return;
    clearWeek();
    store.readerStatus = shiftFailed || weekFailed ? 'failed'
      : shiftReady && receivedSchedule && receivedRoster ? 'ready' : 'loading';
    // Listener delivery is never a server write acknowledgement.
    store.persistenceStatus = store.readerStatus === 'failed' ? 'failed'
      : store.readerStatus === 'ready' ? 'listener' : 'loading';
    store.snapshotSource = store.readerStatus === 'ready' ? 'listener' : 'loading';
    if (store.readerStatus !== 'ready') { render(); return; }
    if (rawSchedule == null) { render(); return; }
    if (!weekShape({ schedule: rawSchedule })) { store.weekStatus = 'invalid'; render(); return; }
    const schedule = rawSchedule.map(row => row.map(cell => ({ id: cell.id, bs: cell.bs ?? null, bd: cell.bd ?? 1 })));
    const attributed = usableRoster(rawRoster) && rawRoster.length === schedule.length;
    const roster = schedule.map((_, index) => ({ name:
      attributed && typeof rawRoster[index]?.name === 'string' && rawRoster[index].name.trim()
        ? rawRoster[index].name : `Fila ${index + 1} · atribución desconocida` }));
    store.scheduleRoster = roster;
    const key = getCurrentWeekStr();
    store.weeks = { [key]: { schedule } };
    const missing = new Set(schedule.flat().filter(cell => !Object.hasOwn(store.SH, cell.id)).map(cell => cell.id));
    if (!schedule.every(row => row.every(cell => missing.has(cell.id) || usableCell(cell, store.SH)))) {
      store.weekStatus = 'invalid';
    } else if (missing.size) {
      store.weekStatus = 'legacy';
    } else {
      store.schedule = structuredClone(schedule);
      store.edited = schedule.map(row => row.map(() => false));
      store.weekStatus = 'loaded';
    }
    render();
  };
  const selectWeek = () => {
    if (!current()) return;
    const version = ++generation;
    weekStops.forEach(stop => stop()); weekStops = [];
    receivedSchedule = false; receivedRoster = false; rawSchedule = null; rawRoster = null; weekFailed = false;
    invalidateEditor(); update();
    const key = getCurrentWeekStr();
    const subscribe = (path, receive) => {
      const valid = () => current() && version === generation && !weekFailed;
      const fail = () => { if (valid()) { weekFailed = true; update(); } };
      try {
        const stop = onValue(ref(db, path), snap => { if (valid()) { receive(snap.val()); update(); } }, fail);
        if (typeof stop === 'function') weekStops.push(stop);
      } catch (_error) { fail(); }
    };
    subscribe(`horario_v5_state/weeks/${key}/schedule`, value => { rawSchedule = value; receivedSchedule = true; });
    subscribe(`horario_v5_state/weekRosters/${key}`, value => { rawRoster = value; receivedRoster = true; });
  };
  const failShifts = () => { if (current() && !shiftFailed) { shiftFailed = true; update(); } };
  try {
    shiftStop = onValue(ref(db, 'horario_v5_state/SH'), snap => {
      if (!current() || shiftFailed) return;
      const value = snap.val();
      store.SH = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
      shiftReady = true; update();
    }, failShifts);
  } catch (_error) { failShifts(); }
  selectWeek();
  const stop = () => {
    if (!active) return;
    active = false;
    weekStops.forEach(unsubscribe => unsubscribe());
    if (typeof shiftStop === 'function') shiftStop();
    if (epoch === readerEpoch) { clearSessionState(); clearAdminCache(); }
  };
  stop.selectWeek = selectWeek;
  return stop;
}
