import { planWeekRoster } from '../domain/weekRoster.js';
import { migrateRosterState, usableRoster } from '../domain/roster.js';
import { DEFAULT_EMPLOYEES } from '../config/employees.js';
import { DEFAULT_SHIFTS } from '../config/shifts.js';
import { usableCell } from '../domain/shift.js';
import { getMonday, addWeeks, weekOffset, isCivilDate } from '../domain/dateUtils.js';
import { db, ref, onValue, set } from '../services/firebase.js';

export const store = {
  EMPLOYEES: JSON.parse(JSON.stringify(DEFAULT_EMPLOYEES)),
  schemaVersion: 2,
  weekRosters: {},
  employeeCounter: 0,
  scheduleRoster: null,
  SH: JSON.parse(JSON.stringify(DEFAULT_SHIFTS)),
  customCounter: 0,
  wo: 0,
  baseDate: getMonday(),
  selectedWeek: null,
  currentDates: [],
  weeks: {},
  isAdmin: false,
  view: 'person',
  schedule: [],
  weekStatus: 'missing',
  readerStatus: 'loading',
  snapshotSource: 'loading',
  persistenceStatus: 'loading',
  pendingWrite: null,
  writeError: null,
  edited: [],
  currentEdit: null,
  activeEditor: null,
  editorInvalidated: false,
  logEntries: [
    { ts: '[init]', msg: 'v5.1 · Sistema Horario Listo', type: 'ok' }
  ]
};

export function getCurrentWeekStr() {
  if (store.selectedWeek) return store.selectedWeek;
  return addWeeks(store.baseDate, store.wo);
}

export function ensureRosterHistory() {
  const migrated = migrateRosterState({ ...store, schemaVersion: undefined });
  store.EMPLOYEES = migrated.EMPLOYEES;
  store.weekRosters = migrated.weekRosters;
  store.employeeCounter = migrated.employeeCounter;
}
export function getActiveEmployees() {
  return store.EMPLOYEES.filter(e => e?.active !== false);
}
export function getWeekEmployees() {
  if (store.scheduleRoster) return store.scheduleRoster;
  const key = getCurrentWeekStr();
  if (Object.hasOwn(store.weekRosters || {}, key)) {
    const roster = store.weekRosters[key];
    if (Array.isArray(roster)) return roster;
    return (store.weeks[key]?.schedule || []).map((_, i) =>
      ({ id: null, name: `Fila ${i + 1} · atribución desconocida`, freeDay: null, active: false }));
  }
  return store.EMPLOYEES.slice(0, store.schedule.length || store.weeks[key]?.schedule?.length || 0);
}

function normalizeSchedule(raw) {
  return (raw || []).map(row =>
    (row || []).map(cell => ({
      ...cell,
      bs: cell.bs != null ? cell.bs : null,
      bd: cell.bd != null ? cell.bd : 1,
    }))
  );
}

// Compare data rather than property insertion order or Firebase's omitted nulls.
export function sameData(a, b) {
  const canonical = value => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort()
      .filter(key => value[key] != null).map(key => [key, canonical(value[key])]));
    return value;
  };
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

// Session-only quarantine: never add markers to, normalize, or repair legacy records.
let legacyWeeks = new Map();
let historicalRosters = new Map();
let pendingRosterTransition = null;
export function weekShape(week) {
  return Array.isArray(week?.schedule) && week.schedule.length > 0
    && week.schedule.every(row => Array.isArray(row) && row.length === 7
      && row.every(cell => cell && typeof cell.id === 'string'
        && (cell.bd == null || cell.bd === 0.5 || cell.bd === 1)
        && (cell.bs == null || (Number.isFinite(cell.bs) && cell.bs >= 0
          && cell.bs + (cell.bd ?? 1) <= 24))));
}
function captureLegacyWeeks() {
  const next = new Map();
  for (const [key, week] of Object.entries(store.weeks)) {
    const serialized = JSON.stringify(week);
    const previous = legacyWeeks.get(key);
    if (previous?.serialized === serialized) { next.set(key, previous); continue; }
    if (!weekShape(week)) continue;
    const missing = new Set(week.schedule.flat().filter(cell => !Object.hasOwn(store.SH, cell.id)).map(cell => cell.id));
    if (missing.size && week.schedule.every(row => row.every(cell => missing.has(cell.id) || usableCell(cell, store.SH)))) {
      next.set(key, { serialized, missing });
    }
  }
  legacyWeeks = next;
}
export function isLegacyWeek(key = getCurrentWeekStr()) {
  return legacyWeeks.has(key);
}

export function invalidateEditor() {
  store.currentEdit = null;
  store.activeEditor = null;
  store.editorInvalidated = true;
}

function editorData() {
  const editor = store.activeEditor;
  if (store.currentEdit) {
    const { pi, di } = store.currentEdit;
    return [getCurrentWeekStr(), store.weekStatus === 'invalid', store.schedule[pi]?.[di],
      store.edited[pi]?.[di], getWeekEmployees()[pi], store.SH];
  }
  if (editor?.kind === 'employee') return [editor.index, store.EMPLOYEES];
  if (editor?.kind === 'shift') return [editor.id, store.SH[editor.id]];
  if (editor?.kind === 'week-team') return [getCurrentWeekStr(), store.weekRosters[getCurrentWeekStr()], store.weeks[getCurrentWeekStr()], store.EMPLOYEES, store.SH];
  if (editor?.kind === 'employees') return store.EMPLOYEES;
  if (editor?.kind === 'shifts') return store.SH;
  return null;
}

function applySnapshot(v) {
  const selected = getCurrentWeekStr();
  const before = editorData();
  v = v && typeof v === 'object' ? v : {};
  store.schemaVersion = v.schemaVersion ?? 2;
  const migrated = migrateRosterState({ ...v, EMPLOYEES: v.EMPLOYEES ?? store.EMPLOYEES });
  for (const [key, week] of Object.entries(v.weeks || {})) {
    if (!Object.hasOwn(v.weekRosters || {}, key) && store.weekRosters[key]
        && JSON.stringify(week) === JSON.stringify(store.weeks[key])) migrated.weekRosters[key] = store.weekRosters[key];
  }
  store.weekRosters = migrated.weekRosters;
  store.employeeCounter = migrated.employeeCounter;
  historicalRosters = new Map(Object.entries(store.weekRosters).map(([key, roster]) => [key, JSON.stringify(roster)]));
  if (pendingRosterTransition && sameData(store.weekRosters[pendingRosterTransition.key], pendingRosterTransition.roster)) {
    historicalRosters.set(pendingRosterTransition.key, JSON.stringify(pendingRosterTransition.beforeRoster));
  }
  store.scheduleRoster = null;
  if (Array.isArray(v.EMPLOYEES)) store.EMPLOYEES = migrated.EMPLOYEES;
  if (v.SH && typeof v.SH === 'object' && !Array.isArray(v.SH)) store.SH = v.SH;
  if (typeof v.customCounter === 'number') store.customCounter = v.customCounter;
  if (isCivilDate(v.baseDate)) store.baseDate = v.baseDate;
  store.selectedWeek = selected;
  store.wo = weekOffset(store.baseDate, selected);
  store.logEntries = Array.isArray(v.logEntries) ? v.logEntries.filter(e => e && typeof e === 'object') : [];
  store.weeks = v.weeks && typeof v.weeks === 'object' && !Array.isArray(v.weeks) ? v.weeks : {};
  captureLegacyWeeks();
  loadSelectedWeek(false);
  if (!sameData(before, editorData())) invalidateEditor();
}

// Navigation only selects existing data; snapshots preserve unchanged editors.
export function loadSelectedWeek(invalidate = true) {
  ensureRosterHistory();
  if (invalidate) invalidateEditor();
  store.schedule = [];
  store.scheduleRoster = null;
  store.edited = [];
  store.weekStatus = 'missing';
  const key = getCurrentWeekStr();
  if (!Object.hasOwn(store.weeks, key)) return;
  const week = store.weeks[key];
  const raw = week?.schedule;
  if (!weekShape(week)) { store.weekStatus = 'invalid'; return; }
  if (!usableRoster(getWeekEmployees())) { store.weekStatus = 'legacy'; return; }
  if (isLegacyWeek(key)) {
    store.weekStatus = JSON.stringify(week) === legacyWeeks.get(key).serialized ? 'legacy' : 'invalid';
    return;
  }
  if (!Array.isArray(raw) || raw.length === 0 || raw.length !== getWeekEmployees().length
      || !getWeekEmployees().every(e => e && typeof e.name === 'string')
      || !raw.every(row => Array.isArray(row) && row.length === 7
        && row.every(cell => usableCell(cell, store.SH)))) {
    store.weekStatus = 'invalid';
    return;
  }
  store.schedule = normalizeSchedule(raw);
  store.edited = raw.map((row, pi) => row.map((_, di) => week.edited?.[pi]?.[di] === true));
  store.weekStatus = week.reviewRequired === true ? 'proposal' : 'loaded';
}

export function canUseShiftCatalog(shifts, weeks = store.weeks) {
  if (!Array.isArray(store.schedule) || !store.schedule.every(row => Array.isArray(row)
      && row.every(cell => usableCell(cell, shifts)))) return false;
  for (const [key, legacy] of legacyWeeks) {
    if (!Object.hasOwn(weeks, key) || JSON.stringify(weeks[key]) !== legacy.serialized
        || [...legacy.missing].some(id => Object.hasOwn(shifts, id))) return false;
  }
  return Object.entries(weeks).every(([key, week]) => weekShape(week)
    && week.schedule.every(row => row.every(cell => legacyWeeks.get(key)?.missing.has(cell.id)
      || usableCell(cell, shifts))));
}

export function shiftHasHistory(id) {
  // Unknown history is a validation failure, never evidence of an unused key.
  return Object.values(store.weeks).some(week => !Array.isArray(week?.schedule)
    || week.schedule.some(row => !Array.isArray(row) || row.some(cell => !cell || cell.id === id)));
}

export function employeeHasHistory(index) {
  ensureRosterHistory();
  const id = store.EMPLOYEES[index]?.id;
  return !id || Object.entries(store.weeks).some(([key, week]) => !Array.isArray(week?.schedule)
    || !usableRoster(store.weekRosters[key]) || store.weekRosters[key].some(e => e.id === id));
}

const clone = value => JSON.parse(JSON.stringify(value));
let writeSequence = 0;
let acknowledged = null;
let syncEpoch = 0;
let syncFailure = null;
function currentSnapshot() {
  return { schemaVersion: 2, weekRosters: store.weekRosters, employeeCounter: store.employeeCounter, EMPLOYEES: store.EMPLOYEES, SH: store.SH, customCounter: store.customCounter,
    baseDate: store.baseDate, weeks: store.weeks, logEntries: store.logEntries };
}
function cache(snapshot, provenance) {
  try {
    localStorage.setItem('horario_v5_state', JSON.stringify({ data: snapshot, provenance }));
  } catch (_error) { /* Cache availability does not determine write acknowledgement. */ }
}
function rerender() {
  if (window._renderUI) window._renderUI();
}

function rejectPersistence(reason) {
  store.persistenceStatus = 'failed';
  store.writeError = `Persistence blocked: ${reason}`;
  rerender();
  throw new Error(store.writeError);
}

const weeklyAuthorization = Symbol('selected-week roster transition');

export function saveState(options = {}) {
  const { saveSelectedWeek = true } = options;
  const transition = options[weeklyAuthorization];
  if (!store.isAdmin) return;
  if (store.schemaVersion > 2) rejectPersistence('unsupported schema version');
  ensureRosterHistory();
  for (const [key, roster] of historicalRosters) {
    if (Object.hasOwn(store.weeks, key) && JSON.stringify(store.weekRosters[key]) !== roster) {
      if (!transition || key !== transition.key || roster !== JSON.stringify(transition.beforeRoster)
          || JSON.stringify(store.weekRosters[key]) !== JSON.stringify(transition.roster)
          || JSON.stringify(store.weeks[key]) !== JSON.stringify(transition.week)) {
        rejectPersistence('historical attribution changed');
      }
    }
  }
  if (!usableRoster(store.EMPLOYEES)) rejectPersistence('invalid employee catalog');
  if (syncFailure) rejectPersistence(`Synchronization failed: ${syncFailure}`);
  if (!canUseShiftCatalog(store.SH)) rejectPersistence('unresolved shift references or unusable definitions');
  const wk = getCurrentWeekStr();
  let weeks = store.weeks;
  if (saveSelectedWeek && store.schedule.length > 0) {
    if (isLegacyWeek(wk) || store.weekStatus === 'legacy') rejectPersistence('legacy week is read-only');
    if (!usableRoster(getWeekEmployees()) || store.schedule.length !== getWeekEmployees().length
        || !store.schedule.every(row => row.length === 7)) rejectPersistence('incomplete week');
    weeks = { ...store.weeks, [wk]: { ...(store.weeks[wk]?.reviewRequired === true ? { reviewRequired: true } : {}), schedule: normalizeSchedule(store.schedule), edited: store.edited.map(row => [...row]) } };
  }
  if (!canUseShiftCatalog(store.SH, weeks)) rejectPersistence('invalid write target or changed legacy history');
  if (saveSelectedWeek && store.schedule.length > 0) {
    store.weekRosters = { ...store.weekRosters, [wk]: clone(getWeekEmployees()) };
  }
  store.weeks = weeks;
  const snapshot = clone(currentSnapshot());
  const token = ++writeSequence;
  const lifecycle = syncEpoch;
  store.pendingWrite = token;
  store.persistenceStatus = 'pending';
  store.writeError = null;
  cache(snapshot, 'pending');
  rerender();
  const finish = (status, error = null) => {
    if (store.pendingWrite !== token || lifecycle !== syncEpoch) return false;
    store.pendingWrite = null;
    if (syncFailure) {
      store.persistenceStatus = 'failed';
      store.writeError = syncFailure;
      rerender();
      return false;
    }
    store.writeError = error;
    if (status === 'persisted') {
      acknowledged = snapshot;
      store.persistenceStatus = sameData(snapshot, currentSnapshot()) ? 'persisted' : 'listener';
      if (store.persistenceStatus === 'persisted' && store.schedule.length && store.weekStatus !== 'invalid') {
        store.weekStatus = store.weeks[getCurrentWeekStr()]?.reviewRequired === true ? 'proposal' : 'persisted';
      }
      cache(currentSnapshot(), store.persistenceStatus);
    } else store.persistenceStatus = status;
    rerender();
    return status === 'persisted';
  };
  try {
    // Only fulfillment of this write promise acknowledges this exact payload.
    return Promise.resolve(set(ref(db, 'horario_v5_state'), snapshot)).then(
      () => finish('persisted'), error => finish('failed', String(error.message || error)));
  } catch (error) {
    return Promise.resolve(finish('failed', String(error.message || error)));
  }
}

// This private capability authorizes one exact selected-week transition only.
export async function mutateWeekRoster(request) {
  const key = getCurrentWeekStr();
  const lifecycle = syncEpoch;
  let beforeRoster, beforeWeek, transition;
  try {
    if (request?.week != null && request.week !== key) throw new Error('La semana seleccionada cambió.');
    if (store.isAdmin !== true) throw new Error('Operación disponible solo para administradores.');
    if (store.pendingWrite != null) throw new Error('Espera a que termine el guardado pendiente.');
    if (!Object.hasOwn(store.weeks, key) || ['legacy', 'invalid', 'missing'].includes(store.weekStatus)
        || isLegacyWeek(key)) throw new Error('Esta semana no permite modificar el equipo.');
    beforeRoster = clone(store.weekRosters[key]); beforeWeek = clone(store.weeks[key]);
    if (historicalRosters.get(key) !== JSON.stringify(beforeRoster)) throw new Error('La atribución cambió; vuelve a cargar la semana.');
    if (!sameData(store.schedule, normalizeSchedule(beforeWeek.schedule)) || !sameData(store.edited, beforeWeek.edited)) {
      throw new Error('Guarda o descarta los cambios de horario antes de modificar el equipo.');
    }
    transition = { key, beforeRoster, ...planWeekRoster({ key, roster: beforeRoster, week: beforeWeek,
      employees: store.EMPLOYEES, shifts: store.SH }, request) };
  } catch (error) { return { ok: false, error: error.message }; }
  store.weekRosters = { ...store.weekRosters, [key]: transition.roster };
  store.weeks = { ...store.weeks, [key]: transition.week };
  pendingRosterTransition = transition;
  const preserveEditor = store.activeEditor?.kind === 'week-team' && store.activeEditor.week === key;
  loadSelectedWeek(!preserveEditor);
  let ok = false;
  try { ok = await saveState({ saveSelectedWeek: false, [weeklyAuthorization]: transition }); }
  catch (error) { store.writeError = error.message; }
  if (pendingRosterTransition === transition) pendingRosterTransition = null;
  if (lifecycle !== syncEpoch) return { ok: false, error: 'La sesión cambió durante el guardado.' };
  if (ok && (!sameData(store.weekRosters[key], transition.roster) || !sameData(store.weeks[key], transition.week))) {
    ok = false; store.writeError = 'Conflicto: el equipo u horario cambió durante el guardado.';
  }
  if (ok) {
    // Only write acknowledgement advances the intentional attribution baseline.
    if (sameData(store.weekRosters[key], transition.roster)) historicalRosters.set(key, JSON.stringify(store.weekRosters[key]));
    return { ok: true };
  }
  // Do not replace newer listener data with a failed optimistic proposal.
  if (sameData(store.weekRosters[key], transition.roster) && sameData(store.weeks[key], transition.week)) {
    store.weekRosters = { ...store.weekRosters, [key]: beforeRoster };
    store.weeks = { ...store.weeks, [key]: beforeWeek };
    historicalRosters.set(key, JSON.stringify(beforeRoster));
  }
  const error = store.writeError || 'No se pudo guardar el equipo de la semana.';
  loadSelectedWeek(!preserveEditor);
  store.persistenceStatus = 'failed'; store.writeError = error;
  cache(currentSnapshot(), 'failed'); rerender();
  return { ok: false, error };
}

export function clearAdminCache() {
  try { localStorage.removeItem?.('horario_v5_state'); } catch (_error) { /* Storage may be unavailable. */ }
}

// Invalidate pending writes as well as all data belonging to the prior auth session.
export function clearSessionState({ admin = false } = {}) {
  const selected = getCurrentWeekStr();
  ++syncEpoch;
  acknowledged = null;
  syncFailure = null;
  legacyWeeks = new Map();
  historicalRosters = new Map();
  pendingRosterTransition = null;
  Object.assign(store, {
    schemaVersion: 2, EMPLOYEES: admin ? clone(DEFAULT_EMPLOYEES) : [],
    SH: admin ? clone(DEFAULT_SHIFTS) : {}, employeeCounter: 0, customCounter: 0,
    baseDate: getMonday(), selectedWeek: selected, weeks: {}, weekRosters: {}, scheduleRoster: null,
    schedule: [], edited: [], logEntries: [], weekStatus: 'missing', readerStatus: 'loading',
    snapshotSource: 'loading', persistenceStatus: 'loading', pendingWrite: null, writeError: null,
  });
  store.wo = weekOffset(store.baseDate, selected);
  invalidateEditor();
}

export function syncState(callback) {
  const lifecycle = ++syncEpoch;
  let active = true;
  let failed = false;
  let unsubscribe;
  acknowledged = null;
  syncFailure = null;
  store.pendingWrite = null;
  store.writeError = null;
  store.snapshotSource = 'loading';
  store.persistenceStatus = 'loading';
  const isCurrent = () => active && lifecycle === syncEpoch;
  const stop = () => {
    if (!active) return;
    active = false;
    if (typeof unsubscribe === 'function') unsubscribe();
    if (lifecycle !== syncEpoch) return;
    clearSessionState();
    clearAdminCache();
  };
  const fail = error => {
    if (!isCurrent() || failed) return;
    failed = true;
    syncFailure = String(error.message || error);
    store.persistenceStatus = 'failed';
    store.writeError = syncFailure;
    rerender();
  };
  let localData;
  try { localData = localStorage.getItem('horario_v5_state'); } catch (_error) { /* Continue without browser cache. */ }
  if (localData) {
    try {
      const cached = JSON.parse(localData);
      applySnapshot(cached?.data ?? cached);
      store.snapshotSource = 'cached';
      store.persistenceStatus = 'cached';
    } catch (_e) { /* Ignore corrupt cache and continue loading. */ }
  }
  if (callback) callback();
  else rerender();
  try {
    unsubscribe = onValue(ref(db, 'horario_v5_state'), snap => {
      if (!isCurrent() || failed) return;
      applySnapshot(snap.val());
      store.snapshotSource = 'listener';
      // RTDB delivers optimistic and offline events; delivery is not an acknowledgement.
      if (store.pendingWrite != null) store.persistenceStatus = 'pending';
      else if (store.persistenceStatus !== 'failed') {
        store.persistenceStatus = acknowledged && sameData(acknowledged, currentSnapshot()) ? 'persisted' : 'listener';
      }
      cache(currentSnapshot(), store.persistenceStatus);
      rerender();
    }, fail);
  } catch (error) {
    fail(error);
  }
  return stop;
}
