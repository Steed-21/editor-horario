export function shiftGrossHours(sh) {
  if(sh.id === 'OFF') return 0;
  return sh.end - sh.start;
}

export function shiftNetHours(sh) {
  if (sh.id === 'OFF' || sh.start === sh.end) return 0;
  return Math.max(0, shiftGrossHours(sh) - (sh.defaultBs != null ? (sh.defaultBd || 1) : 0));
}

// Validate definitions before rendering or writing referenced cells.
export function usableShift(id, sh) {
  return !!sh && typeof sh === 'object' && sh.id === id
    && ['name', 'abbr', 'cls'].every(field => typeof sh[field] === 'string')
    && Number.isFinite(sh.start) && Number.isFinite(sh.end)
    && sh.start >= 0 && sh.end <= 24 && sh.end >= sh.start
    && (sh.defaultBd == null || sh.defaultBd === 0.5 || sh.defaultBd === 1)
    && (sh.defaultBs == null || (Number.isFinite(sh.defaultBs) && sh.defaultBs >= sh.start
      && sh.defaultBs + (sh.defaultBd ?? 1) <= sh.end));
}

export function usableCell(cell, shifts) {
  if (!cell || typeof cell.id !== 'string' || !usableShift(cell.id, shifts?.[cell.id])) return false;
  const sh = shifts[cell.id];
  return (cell.bd == null || cell.bd === 0.5 || cell.bd === 1)
    && (cell.bs == null || (Number.isFinite(cell.bs) && cell.bs >= sh.start
      && cell.bs + (cell.bd ?? 1) <= sh.end));
}
