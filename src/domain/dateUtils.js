const DAY_MS = 86400000;

// Interpret numeric calendar components in UTC solely for civil-day arithmetic.
// Never parse a civil key as a timestamp or pass it through local Date getters.
function civilDay(key) {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) throw new RangeError('Invalid civil date');
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new RangeError('Invalid civil date');
  }
  return date.getTime() / DAY_MS;
}

function civilKey(day) {
  const date = new Date(day * DAY_MS);
  const year = date.getUTCFullYear();
  if (!Number.isInteger(year) || year < 0 || year > 9999) throw new RangeError('Civil date out of range');
  return `${String(year).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function isCivilDate(key) {
  try { civilDay(key); return true; } catch (_error) { return false; }
}

export function addWeeks(key, offset) {
  if (!Number.isSafeInteger(offset)) throw new RangeError('Invalid week offset');
  return civilKey(civilDay(key) + offset * 7);
}

export function weekOffset(baseKey, selectedKey) {
  return Math.round((civilDay(selectedKey) - civilDay(baseKey)) / 7);
}

export function getMonday(dateStr) {
  if (dateStr === undefined) {
    // The initial week follows the user's local calendar, extracted before arithmetic.
    const now = new Date();
    dateStr = `${String(now.getFullYear()).padStart(4, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  const day = civilDay(dateStr);
  const weekday = new Date(day * DAY_MS).getUTCDay();
  return civilKey(day - (weekday + 6) % 7);
}

export function getDatesForWeek(baseDateStr, wo) {
  const first = civilDay(addWeeks(baseDateStr, wo));
  return Array.from({ length: 7 }, (_, i) => {
    const key = civilKey(first + i);
    const day = key.slice(8, 10), month = key.slice(5, 7);
    return { day, month, str: `${day}/${month}` };
  });
}

export function formatHour(h) {
  if (h == null) return '';
  const whole = Math.floor(h);
  const half = (h - whole) === 0.5 ? ':30' : (whole === 24 ? '' : ':00');
  return `${whole}${half}`;
}
