import { store, saveState, employeeHasHistory, ensureRosterHistory } from '../../state/store.js';
import { DF } from '../../config/constants.js';
import { log } from '../components/log.js';
import { openModal } from './modal.js';
import { render } from '../layout.js';
import { esc } from '../../utils/escape.js';

import { openWeekTeamEditor } from './weekTeamEditor.js';
import { getCurrentWeekStr, getWeekEmployees } from '../../state/store.js';

import { validFreeDay } from '../../domain/roster.js';

function readDay(id) {
  const value = document.getElementById(id).value;
  return /^[0-6]$/.test(value) ? Number(value) : NaN;
}
function validationError(message) {
  log(message, 'err');
  const error = document.getElementById('employeeError');
  if (error) error.textContent = message;
}
export function openEmployeesEditor() {
  if (!store.isAdmin) return;
  store.currentEdit = null;
  store.activeEditor = { kind: 'employees' };
  store.editorInvalidated = false;
  document.getElementById('modalTitle').textContent = 'Gestión de empleados';
  const rows = store.EMPLOYEES.map((e, i) => `
    <div class="emp-item ${e.active === false ? 'inactive' : 'active'}">
      <div>
        <div class="emp-name">${esc(e.name)}</div>
        <div class="emp-day"><span class="employee-status">${e.active === false ? 'Inactivo' : 'Activo'}</span> · Libre por defecto: ${DF[e.freeDay]}</div>
      </div>
      <button onclick="window.openEmployeeEdit(${i})">Editar</button>
      <button class="state-action" onclick="window.deactivateEmployee(${i})">${e.active === false ? 'Activar' : 'Desactivar'}</button>
      <button class="del" aria-label="Eliminar ${esc(e.name)}" onclick="window.deleteEmployee(${i})">×</button>
    </div>
  `).join('');

  document.getElementById('modalBody').innerHTML = `
    <div id="employeeError" class="editor-error" role="alert"></div>
    <h3>Equipo general · ${store.EMPLOYEES.filter(e => e.active === true).length} activos</h3>
    <button class="new-shift-btn" onclick="window.openEmployeeAdd()">+ Añadir empleado</button>
    <div class="info-box">El nuevo empleado estará disponible al crear nuevas semanas. Las semanas guardadas no cambian.</div>
    <div class="emp-list editor-list">${rows}</div>
    <section aria-labelledby="weekTeamHeading">
      <h3 id="weekTeamHeading">Equipo · ${esc(getCurrentWeekStr())}</h3>
      <p>${getWeekEmployees().length} personas</p>
      <button type="button" class="new-shift-btn" id="openWeekTeam">Modificar equipo de esta semana</button>
    </section>
  `;
  document.getElementById('openWeekTeam')?.addEventListener('click', openWeekTeamEditor);
  openModal();
}

export function openEmployeeAdd() {
  store.currentEdit = null;
  store.activeEditor = { kind: 'employees' };
  store.editorInvalidated = false;
  document.getElementById('modalTitle').textContent = 'Añadir empleado';
  const dc = Array(7).fill(0);
  store.EMPLOYEES.forEach(e => dc[e.freeDay]++);
  const ds = [0, 1, 2, 3, 4, 5, 6].map(d => `<option value="${d}">${DF[d]} (${dc[d]} ya libran)</option>`).join('');
  
  document.getElementById('modalBody').innerHTML = `
    <div id="employeeError" class="editor-error" role="alert"></div>
    <div class="edit-grid">
      <label for="newEmpName">Nombre</label><div class="editor-row"><input type="text" id="newEmpName" placeholder="Nombre" autofocus/></div>
      <label for="newEmpDay">Día libre por defecto</label><div class="editor-row"><select id="newEmpDay">${ds}</select></div>
    </div>
    <div class="info-box">Disponible para nuevas semanas. Las semanas guardadas conservan sus filas originales.</div>
    <div class="editor-footer">
      <button class="action-btn" onclick="window.openEmployeesEditor()">← Volver</button>
      <button class="action-btn primary" onclick="window.confirmAddEmployee()">Añadir</button>
    </div>
  `;
}

export function confirmAddEmployee() {
  if (!store.isAdmin) return;
  const n = document.getElementById('newEmpName').value.trim();
  if (!n) { validationError('Nombre vacío'); return; }
  if (store.EMPLOYEES.some(e => e.name.toLowerCase() === n.toLowerCase())) {
    validationError(`"${n}" ya existe`); return;
  }
  const fd = readDay('newEmpDay');
  if (!validFreeDay(fd)) { validationError('Día libre inválido'); return; }

  ensureRosterHistory();
  let id;
  do { id = `employee-${++store.employeeCounter}`; }
  while (store.EMPLOYEES.some(e => e.id === id) || Object.values(store.weekRosters).some(roster => Array.isArray(roster) && roster.some(e => e?.id === id)));
  store.EMPLOYEES.push({ id, name: n, freeDay: fd, active: true });

  log(`Añadido: ${n} (libre ${DF[fd]}) · disponible para nuevas semanas`, 'ok');
  saveState({ saveSelectedWeek: false });
  render();
  openEmployeesEditor();
}

export function openEmployeeEdit(idx) {
  store.currentEdit = null;
  store.activeEditor = { kind: 'employee', index: idx };
  store.editorInvalidated = false;
  const e = store.EMPLOYEES[idx];
  document.getElementById('modalTitle').textContent = `Editar: ${e.name}`;
  const ds = [0, 1, 2, 3, 4, 5, 6].map(d => `<option value="${d}" ${e.freeDay === d ? 'selected' : ''}>${DF[d]}</option>`).join('');
  
  document.getElementById('modalBody').innerHTML = `
    <div id="employeeError" class="editor-error" role="alert"></div>
    <div class="edit-grid">
      <label for="edEmpName">Nombre</label><div class="editor-row"><input type="text" id="edEmpName" value="${esc(e.name)}"/></div>
      <label for="edEmpDay">Día libre por defecto</label><div class="editor-row"><select id="edEmpDay">${ds}</select></div>
    </div>
    <div class="info-box">Nombre y día libre por defecto se aplican a semanas futuras. Las semanas guardadas conservan su atribución y horario.</div>
    <div class="editor-footer">
      <button class="action-btn" onclick="window.openEmployeesEditor()">← Volver</button>
      <button class="action-btn primary" onclick="window.saveEmployeeEdit(${idx})">Guardar</button>
    </div>
  `;
}

export function saveEmployeeEdit(idx) {
  if (!store.isAdmin) return;
  const n = document.getElementById('edEmpName').value.trim();
  const nd = readDay('edEmpDay');
  if (!n) { validationError('Nombre vacío'); return; }
  if (store.EMPLOYEES.some((e, i) => i !== idx && e.name.toLowerCase() === n.toLowerCase())) {
    validationError(`"${n}" ya existe`); return;
  }

  const old = store.EMPLOYEES[idx];
  const dayChanged = old.freeDay !== nd;
  const nameChanged = old.name !== n;

  if (!validFreeDay(nd)) { validationError('Día libre inválido'); return; }
  ensureRosterHistory();
  store.EMPLOYEES[idx] = { ...store.EMPLOYEES[idx], name: n, freeDay: nd };

  if (dayChanged && nameChanged) {
    log(`${n}: ${old.name} → ${n}, libre → ${DF[nd]}`, 'warn');
  } else if (dayChanged) {
    log(`${n}: libre → ${DF[nd]} (horario sin tocar)`, 'warn');
  } else if (nameChanged) {
    log(`Nombre: ${old.name} → ${n}`, 'ok');
  }

  saveState({ saveSelectedWeek: false });
  render();
  openEmployeesEditor();
}

export function deleteEmployee(idx) {
  if (!store.isAdmin) return;
  if (store.EMPLOYEES.length <= 1) {
    log('No puedes eliminar al último', 'err');
    return;
  }
  if (employeeHasHistory(idx)) {
    validationError('Eliminación bloqueada: empleado en semanas guardadas; usa Desactivar');
    return;
  }
  const n = store.EMPLOYEES[idx].name;

  ensureRosterHistory();
  store.EMPLOYEES.splice(idx, 1);

  log(`Eliminado: ${n}`, 'warn');
  saveState({ saveSelectedWeek: false });
  render();
  openEmployeesEditor();
}

export function deactivateEmployee(idx) {
  if (!store.isAdmin || !store.EMPLOYEES[idx]) return;
  ensureRosterHistory();
  const employee = store.EMPLOYEES[idx];
  if (employee.active && store.EMPLOYEES.filter(e => e.active).length <= 1) {
    validationError('No puedes desactivar al último empleado activo'); return;
  }
  store.EMPLOYEES[idx] = { ...employee, active: !employee.active };
  log(`${employee.name}: ${employee.active ? 'desactivado' : 'activado'} para semanas futuras`, 'ok');
  saveState({ saveSelectedWeek: false });
  render(); openEmployeesEditor();
}
