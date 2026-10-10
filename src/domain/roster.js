const copy = value => JSON.parse(JSON.stringify(value));
export const validFreeDay = day => Number.isInteger(day) && day >= 0 && day <= 6;
export const usableEmployee = e => e && typeof e.id === 'string' && e.id.length > 0
  && typeof e.name === 'string' && e.name.trim().length > 0 && validFreeDay(e.freeDay)
  && typeof e.active === 'boolean';
export const usableRoster = roster => Array.isArray(roster) && roster.length > 0
  && roster.every(usableEmployee) && new Set(roster.map(e => e.id)).size === roster.length;

// Sidecar attribution preserves positional week objects byte-for-byte. Legacy names
// are the names observed at migration, not a claim to recover earlier metadata.
export function migrateRosterState(data) {
  const employees = Array.isArray(data.EMPLOYEES) ? data.EMPLOYEES : [];
  const used = new Set(employees.filter(e => typeof e?.id === 'string').map(e => e.id));
  const EMPLOYEES = employees.map((e, i) => {
    if (!e || typeof e !== 'object') return e;
    let id = e.id;
    if (typeof id !== 'string' || !id) {
      id = `legacy-employee-${i + 1}`;
      while (used.has(id)) id += '-legacy';
      used.add(id);
    }
    return { ...e, id, active: e.active ?? true };
  });
  const weekRosters = data.weekRosters && typeof data.weekRosters === 'object' && !Array.isArray(data.weekRosters) ? copy(data.weekRosters) : {};
  for (const [key, week] of Object.entries(data.weeks || {})) {
    if (!Object.hasOwn(weekRosters, key) && Array.isArray(week?.schedule)) {
      weekRosters[key] = week.schedule.map((_, i) => data.schemaVersion !== 2 && EMPLOYEES[i] ? { ...copy(EMPLOYEES[i]), attribution: 'legacy-observed' }
        : { id: null, name: `Fila ${i + 1} · atribución desconocida`, freeDay: null, active: false });
    }
  }
  return { ...data, schemaVersion: 2, EMPLOYEES, weekRosters,
    employeeCounter: Number.isSafeInteger(data.employeeCounter) && data.employeeCounter >= 0 ? data.employeeCounter : 0 };
}
