export function shiftGrossHours(sh) {
  if(sh.id === 'OFF') return 0;
  return sh.end - sh.start;
}

export function shiftNetHours(sh) {
  if (sh.id === 'OFF' || sh.start === sh.end) return 0;
  return Math.max(0, shiftGrossHours(sh) - (sh.defaultBs != null ? (sh.defaultBd || 1) : 0));
}
