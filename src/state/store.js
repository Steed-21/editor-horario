import { DEFAULT_EMPLOYEES } from '../config/employees.js';
import { DEFAULT_SHIFTS } from '../config/shifts.js';
import { getMonday } from '../domain/dateUtils.js';
import { db, ref, onValue, update } from '../services/firebase.js';

export const store = {
  EMPLOYEES: JSON.parse(JSON.stringify(DEFAULT_EMPLOYEES)),
  SH: JSON.parse(JSON.stringify(DEFAULT_SHIFTS)),
  customCounter: 0,
  wo: 0,
  baseDate: getMonday(),
  currentDates: [],
  weeks: {},
  isAdmin: false,
  view: 'person',
  schedule: [],
  edited: [],
  currentEdit: null,
  logEntries: [
    { ts: '[init]', msg: 'v5.1 · Sistema Horario Listo', type: 'ok' }
  ]
};

export function getCurrentWeekStr() {
  const d = new Date(store.baseDate);
  d.setDate(d.getDate() + store.wo * 7);
  return d.toISOString().split('T')[0];
}

// Marca temporal de la última escritura propia. Sirve para descartar el "eco"
// que el listener onValue recibirá del mismo cambio que acabamos de subir,
// evitando que pise ediciones rápidas en vuelo (race condition).
let lastSaveTs = 0;
// Cooldown anti-eco: durante este tiempo tras una escritura propia, ignoramos
// snapshots remotos para no sobrescribir el store local con datos en tránsito.
const SAVE_ECHO_COOLDOWN_MS = 1500;

export function saveState() {
  if (!store.isAdmin) return;
  const wk = getCurrentWeekStr();
  if (store.schedule.length > 0) {
    store.weeks[wk] = { schedule: store.schedule, edited: store.edited };
  }

  // Caché local completa (arranque rápido offline)
  const snapshot = {
    EMPLOYEES: store.EMPLOYEES,
    SH: store.SH,
    customCounter: store.customCounter,
    wo: store.wo,
    baseDate: store.baseDate,
    weeks: store.weeks,
    logEntries: store.logEntries
  };
  localStorage.setItem('horario_v5_state', JSON.stringify(snapshot));

  // Marcar timestamp ANTES de la escritura para descartar el eco inmediato.
  lastSaveTs = Date.now();

  // Escritura granular por sub-rutas: update() solo afecta las claves
  // especificadas, no toca el resto del subárbol. Si dos dispositivos editan
  // semanas distintas, ya no se pisan entre sí.
  const updates = {
    'horario_v5_state/EMPLOYEES': store.EMPLOYEES,
    'horario_v5_state/SH': store.SH,
    'horario_v5_state/customCounter': store.customCounter,
    'horario_v5_state/baseDate': store.baseDate,
    'horario_v5_state/logEntries': store.logEntries,
  };
  if (store.schedule.length > 0) {
    updates[`horario_v5_state/weeks/${wk}`] = { schedule: store.schedule, edited: store.edited };
  }

  try {
    update(ref(db), updates).catch(e => console.warn('Firebase guardado falló:', e));
  } catch(e) { console.warn(e); }
}

export function syncState(callback) {
  // Carga local instantánea de seguridad
  const localData = localStorage.getItem('horario_v5_state');
  if (localData) {
    try {
      const p = JSON.parse(localData);
      store.EMPLOYEES = p.EMPLOYEES || store.EMPLOYEES;
      store.SH = p.SH || store.SH;
      store.customCounter = p.customCounter || 0;
      store.wo = p.wo || 0;
      store.baseDate = p.baseDate || store.baseDate;
      store.weeks = p.weeks || {};
      store.logEntries = p.logEntries || store.logEntries;
      
      const wk = getCurrentWeekStr();
      if (store.weeks[wk]) {
        store.schedule = store.weeks[wk].schedule;
        store.edited = store.weeks[wk].edited;
      }
    } catch (_e) { /* localStorage corrupto: ignorar y seguir con defaults */ }
  }

  // Desbloquea la UI de inmediato.
  // IMPORTANTE: resetear lastSaveTs para que los listeners de Firebase no sean
  // bloqueados por el eco-cooldown al arrancar por primera vez.
  lastSaveTs = 0;
  if (callback) {
    callback();
    callback = null;
  }
  if (window._renderUI) window._renderUI();

  try {
    const root = 'horario_v5_state';
    const inEcho = () => (Date.now() - lastSaveTs) < SAVE_ECHO_COOLDOWN_MS;
    const rerender = () => { if (window._renderUI) window._renderUI(); };

    // Listener por sub-ruta: cada uno aplica sólo su clave. Si una sub-ruta
    // cambia en remoto, no se toca el resto del store. Esto evita que un
    // cambio en EMPLOYEES pise una edición en curso de una celda, y viceversa.

    onValue(ref(db, `${root}/EMPLOYEES`), (snap) => {
      if (inEcho()) return;
      const v = snap.val();
      if (Array.isArray(v)) store.EMPLOYEES = v;
      rerender();
    }, (e) => console.warn('listener EMPLOYEES:', e));

    onValue(ref(db, `${root}/SH`), (snap) => {
      if (inEcho()) return;
      const v = snap.val();
      if (v && typeof v === 'object') store.SH = v;
      rerender();
    }, (e) => console.warn('listener SH:', e));

    onValue(ref(db, `${root}/customCounter`), (snap) => {
      if (inEcho()) return;
      const v = snap.val();
      if (typeof v === 'number') store.customCounter = v;
    }, (e) => console.warn('listener customCounter:', e));

    onValue(ref(db, `${root}/baseDate`), (snap) => {
      if (inEcho()) return;
      const v = snap.val();
      // baseDate es un string ISO (ej: "2026-05-19"), no un número
      if (v && typeof v === 'string') store.baseDate = v;
    }, (e) => console.warn('listener baseDate:', e));

    onValue(ref(db, `${root}/logEntries`), (snap) => {
      if (inEcho()) return;
      const v = snap.val();
      if (Array.isArray(v)) store.logEntries = v;
    }, (e) => console.warn('listener logEntries:', e));

    // Listener de weeks: aplica el snapshot completo de semanas y, si la
    // semana actual existe, refresca schedule/edited. No vacía nunca el
    // schedule local si la semana actual no existe en remoto.
    onValue(ref(db, `${root}/weeks`), (snap) => {
      if (inEcho()) return;
      const v = snap.val() || {};
      store.weeks = v;
      const wk = getCurrentWeekStr();
      if (store.weeks[wk]) {
        // Firebase elimina las claves con valor null. Normalizamos bs → null y bd → 1
        // para evitar que aparezcan como undefined en los cálculos.
        const rawSchedule = store.weeks[wk].schedule || [];
        store.schedule = rawSchedule.map(row =>
          (row || []).map(cell => ({
            ...cell,
            bs: cell.bs != null ? cell.bs : null,
            bd: cell.bd != null ? cell.bd : 1,
          }))
        );
        store.edited = store.weeks[wk].edited || store.schedule.map(row => row.map(() => false));
      }
      rerender();
    }, (e) => console.warn('listener weeks:', e));
  } catch(e) {
    console.warn("Firebase no configurado aún:", e);
  }
}
