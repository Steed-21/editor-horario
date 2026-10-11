import { getMonday, isCivilDate } from './dateUtils.js';
import { usableRoster, usableEmployee } from './roster.js';
import { usableCell } from './shift.js';

export function classifyWeek(key) {
  if (!isCivilDate(key) || getMonday(key) !== key) throw new Error('Semana inválida.');
  const current = getMonday();
  return key < current ? 'past' : key === current ? 'current' : 'future';
}

export function weekCandidates(employees, roster) {
  if (!usableRoster(roster) || !Array.isArray(employees)) return [];
  const counts = new Map();
  employees.forEach(e => { if (e?.id) counts.set(e.id, (counts.get(e.id) || 0) + 1); });
  return employees.filter(e => usableEmployee(e) && e.active === true && counts.get(e.id) === 1
    && !roster.some(member => member.id === e.id));
}

export function usableWeekTeam(roster, week, shifts) {
  return usableRoster(roster) && roster.every(e => !e.attribution)
    && Array.isArray(week?.schedule) && Array.isArray(week.edited)
    && week.schedule.length === roster.length && week.edited.length === roster.length
    && week.schedule.every(row => Array.isArray(row) && row.length === 7 && row.every(cell => usableCell(cell, shifts)))
    && week.edited.every(row => Array.isArray(row) && row.length === 7 && row.every(value => typeof value === 'boolean'));
}

// Construct only the intended positional transition; never regenerate planned rows.
export function planWeekRoster({ key, roster, week, employees, shifts }, { operation, candidateId, targetId, confirmation, confirmed }) {
  const kind = classifyWeek(key);
  if (kind === 'past') throw new Error('Histórico: esta semana está cerrada.');
  if (!['add', 'replace', 'remove'].includes(operation)) throw new Error('Operación inválida.');
  if (operation === 'remove' && confirmation !== 'ELIMINAR') throw new Error('Escribe exactamente ELIMINAR para quitar la fila.');
  if (operation === 'replace' && kind === 'current' && confirmed !== true) throw new Error('Confirma la sustitución de toda la fila.');
  if (!usableWeekTeam(roster, week, shifts)) throw new Error('Equipo, atribución u horario no válido.');
  const index = roster.findIndex(e => e.id === targetId);
  if (operation !== 'add' && (typeof targetId !== 'string' || !targetId || index < 0)) throw new Error('Empleado de destino inválido.');
  const candidate = operation === 'remove' ? null : weekCandidates(employees, roster).find(e => e.id === candidateId);
  if (operation !== 'remove' && !candidate) throw new Error('Selecciona un empleado activo que aún no esté en esta semana.');
  if (operation === 'remove' && roster.length === 1) throw new Error('No puedes eliminar al último empleado de la semana.');
  const nextRoster = structuredClone(roster), nextWeek = structuredClone(week);
  if (operation === 'add') {
    nextRoster.push(structuredClone(candidate));
    nextWeek.schedule.push(Array.from({ length: 7 }, () => ({ id: 'OFF', bs: null, bd: 1 })));
    nextWeek.edited.push(Array(7).fill(false));
  } else if (operation === 'replace') nextRoster[index] = structuredClone(candidate);
  else {
    nextRoster.splice(index, 1); nextWeek.schedule.splice(index, 1); nextWeek.edited.splice(index, 1);
  }
  nextWeek.reviewRequired = true;
  if (!usableWeekTeam(nextRoster, nextWeek, shifts)) throw new Error('El equipo resultante no es válido.');
  return { roster: nextRoster, week: nextWeek };
}
