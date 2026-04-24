import { store } from '../state/store.js';

export function makeCell(id, bsOverride) {
  const sh = store.SH[id];
  return { id, bs: bsOverride !== undefined ? bsOverride : sh.defaultBs };
}

export function cellHours(cell) {
  const sh = store.SH[cell.id];
  if (sh.id === 'OFF') return 0;
  return Math.max(0, (sh.end - sh.start) - (cell.bs != null ? 1 : 0));
}

export function cellLabel(cell) {
  const sh = store.SH[cell.id];
  if (sh.id === 'OFF') return 'Libre';
  if (sh.start === sh.end) return sh.abbr || sh.name;
  return `${sh.start}–${sh.end === 24 ? '24' : sh.end}`;
}

export function borderClass(cell) {
  const h = cellHours(cell);
  if (h === 0) return 'border-off';
  if (h === 6) return 'border-6h';
  if (h === 7) return 'border-7h';
  if (h === 8) return 'border-8h';
  return 'border-other';
}
