import { DEFAULT_EMPLOYEES } from '../config/employees.js';
import { DEFAULT_SHIFTS } from '../config/shifts.js';
import initData from '../config/data.json';
import { getMonday } from '../domain/dateUtils.js';
import { db, ref, set, onValue } from '../services/firebase.js';

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

export function saveState() {
  if (!store.isAdmin) return;
  if (store.schedule.length > 0) {
    const currentWeekStr = getCurrentWeekStr();
    store.weeks[currentWeekStr] = { schedule: store.schedule, edited: store.edited };
  }
  const snapshot = {
    EMPLOYEES: store.EMPLOYEES,
    SH: store.SH,
    customCounter: store.customCounter,
    wo: store.wo,
    baseDate: store.baseDate,
    weeks: store.weeks,
    logEntries: store.logEntries
  };
  
  // Guardado local de seguridad
  localStorage.setItem('horario_v5_state', JSON.stringify(snapshot));
  
  try {
    set(ref(db, 'horario_v5_state'), snapshot).catch(e => console.warn('Firebase guardado falló:', e));
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
    } catch(e) {}
  }

  // Desbloquea la UI de inmediato
  if (callback) {
    callback();
    callback = null;
  }
  if (window._renderUI) window._renderUI();

  try {
    const stateRef = ref(db, 'horario_v5_state');
    onValue(stateRef, (snapshot) => {
      const p = snapshot.val();
      if (p) {
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
        } else {
          store.schedule = [];
        }
        if (window._renderUI) window._renderUI();
      }
    }, (error) => {
      console.warn("Error leyendo Firebase:", error);
    });
  } catch(e) {
    console.warn("Firebase no configurado aún:", e);
  }
}
