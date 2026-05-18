import { DEFAULT_EMPLOYEES } from '../config/employees.js';
import { DEFAULT_SHIFTS } from '../config/shifts.js';
import { getMonday } from '../domain/dateUtils.js';
import { db, ref, onValue, set } from '../services/firebase.js';

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

// Normaliza las celdas que vienen de Firebase, que elimina las claves null.
// bs → null, bd → 1 por defecto.
function normalizeSchedule(raw) {
  return (raw || []).map(row =>
    (row || []).map(cell => ({
      ...cell,
      bs: cell.bs != null ? cell.bs : null,
      bd: cell.bd != null ? cell.bd : 1,
    }))
  );
}

// Aplica un snapshot completo de Firebase al store y actualiza el schedule
// de la semana actual si existe.
function applySnapshot(v) {
  if (!v || typeof v !== 'object') return;
  if (Array.isArray(v.EMPLOYEES)) store.EMPLOYEES = v.EMPLOYEES;
  if (v.SH && typeof v.SH === 'object') store.SH = v.SH;
  if (typeof v.customCounter === 'number') store.customCounter = v.customCounter;
  if (v.baseDate && typeof v.baseDate === 'string') store.baseDate = v.baseDate;
  if (Array.isArray(v.logEntries)) store.logEntries = v.logEntries;
  if (v.weeks && typeof v.weeks === 'object') {
    store.weeks = v.weeks;
    const wk = getCurrentWeekStr();
    if (store.weeks[wk]) {
      store.schedule = normalizeSchedule(store.weeks[wk].schedule);
      store.edited = store.weeks[wk].edited
        || store.schedule.map(r => r.map(() => false));
    }
  }
}

// ─── GUARDAR ────────────────────────────────────────────────────────────────
// Escribe el estado completo del admin en Firebase (fuente de verdad).
// También actualiza localStorage como caché de arranque rápido.
// Solo el admin puede escribir (Firebase Rules: auth != null).
export function saveState() {
  if (!store.isAdmin) return;

  // Asegurarnos de que la semana actual está en store.weeks antes de guardar.
  const wk = getCurrentWeekStr();
  if (store.schedule.length > 0) {
    store.weeks[wk] = { schedule: store.schedule, edited: store.edited };
  }

  const snapshot = {
    EMPLOYEES: store.EMPLOYEES,
    SH: store.SH,
    customCounter: store.customCounter,
    baseDate: store.baseDate,
    weeks: store.weeks,
    logEntries: store.logEntries,
  };

  // Caché local para arranque offline/rápido.
  localStorage.setItem('horario_v5_state', JSON.stringify(snapshot));

  // set() escribe el nodo completo de forma atómica.
  // El listener onValue recibirá el eco de nuestra escritura y aplicará
  // exactamente los datos que acabamos de guardar — esto es correcto y seguro.
  try {
    set(ref(db, 'horario_v5_state'), snapshot)
      .catch(e => console.warn('[Firebase] Guardado falló:', e));
  } catch(e) { console.warn(e); }
}

// ─── SINCRONIZAR ─────────────────────────────────────────────────────────────
// Arquitectura: UN SOLO listener en la raíz. Firebase es la fuente de verdad.
// Flujo:
//   1. Carga localStorage al instante → UI visible sin esperar red.
//   2. Dispara el callback (setupEvents + primer render).
//   3. El listener de Firebase actualiza el store cada vez que hay un cambio
//      (propio o de otro dispositivo) y vuelve a renderizar.
//
// Sin cooldown anti-eco: el SDK de Firebase desactiva el listener de red en
// modo offline y los datos siempre son los últimos confirmados por el servidor.
// Confiar en Firebase es más simple y fiable que gestionar cooldowns manuales.
export function syncState(callback) {
  // 1. Carga rápida desde localStorage
  const localData = localStorage.getItem('horario_v5_state');
  if (localData) {
    try {
      applySnapshot(JSON.parse(localData));
    } catch (_e) { /* localStorage corrupto: continuar con defaults */ }
  }

  // 2. Arrancar la UI sin esperar a Firebase
  if (callback) { callback(); callback = null; }
  if (window._renderUI) window._renderUI();

  // 3. Listener único en la raíz — Firebase como fuente de verdad
  try {
    onValue(ref(db, 'horario_v5_state'), (snap) => {
      const v = snap.val();

      if (!v) {
        // Firebase vacío: la UI ya está renderizada con defaults/localStorage.
        // No hacer nada — evitar sobrescribir con nulo.
        return;
      }

      // Aplicar datos de Firebase (siempre canónicos).
      applySnapshot(v);

      // Actualizar caché local con los datos más recientes de Firebase.
      localStorage.setItem('horario_v5_state', JSON.stringify(v));

      if (window._renderUI) window._renderUI();
    }, (e) => console.warn('[Firebase] Listener error:', e));
  } catch(e) {
    console.warn('[Firebase] No configurado:', e);
  }
}
