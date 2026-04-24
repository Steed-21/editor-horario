import { DEFAULT_EMPLOYEES } from '../config/employees.js';
import { DEFAULT_SHIFTS } from '../config/shifts.js';

export const store = {
  EMPLOYEES: JSON.parse(JSON.stringify(DEFAULT_EMPLOYEES)),
  SH: JSON.parse(JSON.stringify(DEFAULT_SHIFTS)),
  customCounter: 0,
  wo: 0,
  view: 'person',
  schedule: [],
  edited: [],
  currentEdit: null,
  logEntries: [
    { ts: '[init]', msg: 'v5.1 · inicializado módulo Vite', type: 'ok' }
  ]
};
