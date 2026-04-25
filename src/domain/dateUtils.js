export function getMonday(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

export function getDatesForWeek(baseDateStr, wo) {
  const base = new Date(baseDateStr);
  base.setDate(base.getDate() + (wo * 7));
  const dates = [];
  for(let i = 0; i < 7; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    dates.push({ day: dd, month: mm, str: `${dd}/${mm}` });
  }
  return dates;
}

export function formatHour(h) {
  if (h == null) return '';
  const whole = Math.floor(h);
  const half = (h - whole) === 0.5 ? ':30' : (whole === 24 ? '' : ':00');
  return `${whole}${half}`;
}
