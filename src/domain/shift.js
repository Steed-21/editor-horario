export function shiftGrossHours(sh) {
  if(sh.id === 'OFF') return 0;
  return sh.end - sh.start;
}

export function shiftNetHours(sh) {
  return Math.max(0, shiftGrossHours(sh) - (sh.defaultBs !== null ? 1 : 0));
}
