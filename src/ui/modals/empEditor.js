import { store, saveState } from '../../state/store.js';
import { DF } from '../../config/constants.js';
import { log } from '../components/log.js';
import { makeCell } from '../../domain/cell.js';
import { openModal } from './modal.js';
import { render } from '../layout.js';
import { esc } from '../../utils/escape.js';

// Genera una fila de 7 celdas en OFF (libre). Se usa al insertar un empleado
// nuevo: entra sin horario asignado para que el admin decida turno a turno
// sin pisar al resto del equipo.
function makeOffRow() {
  return Array.from({ length: 7 }, () => makeCell('OFF'));
}

// Aplica una operación sobre store.schedule, store.edited y sobre cada
// schedule/edited de store.weeks. Mantiene consistencia entre la semana
// actual en memoria y todas las semanas persistidas.
function mutateAllSchedules(opSchedule, opEdited) {
  if (Array.isArray(store.schedule)) opSchedule(store.schedule);
  if (Array.isArray(store.edited)) opEdited(store.edited);
  if (store.weeks && typeof store.weeks === 'object') {
    for (const wk of Object.keys(store.weeks)) {
      const w = store.weeks[wk];
      if (!w) continue;
      if (Array.isArray(w.schedule)) opSchedule(w.schedule);
      if (Array.isArray(w.edited)) opEdited(w.edited);
    }
  }
}

export function openEmployeesEditor() {
  document.getElementById('modalTitle').textContent = 'Gestión de empleados';
  const rows = store.EMPLOYEES.map((e, i) => `
    <div class="emp-item">
      <div>
        <div class="emp-name">${esc(e.name)}</div>
        <div class="emp-day">Libre: ${DF[e.freeDay]}</div>
      </div>
      <button onclick="window.openEmployeeEdit(${i})">Editar</button>
      <button class="del" onclick="window.deleteEmployee(${i})">×</button>
      <span style="width:4px"></span>
    </div>
  `).join('');

  document.getElementById('modalBody').innerHTML = `
    <button class="new-shift-btn" onclick="window.openEmployeeAdd()">+ Añadir empleado</button>
    <div class="info-box">El nuevo empleado entra con la semana en Libre. Tú asignas sus turnos sin afectar al resto.</div>
    <div class="emp-list" style="margin-top:.75rem">${rows}</div>
  `;
  openModal();
}

export function openEmployeeAdd() {
  document.getElementById('modalTitle').textContent = 'Añadir empleado';
  const dc = [0, 0, 0, 0, 0];
  store.EMPLOYEES.forEach(e => dc[e.freeDay]++);
  const ds = [0, 1, 2, 3, 4].map(d => `<option value="${d}">${DF[d]} (${dc[d]} ya libran)</option>`).join('');
  
  document.getElementById('modalBody').innerHTML = `
    <div class="edit-grid">
      <label>Nombre</label><div class="editor-row"><input type="text" id="newEmpName" placeholder="Nombre" autofocus/></div>
      <label>Día libre</label><div class="editor-row"><select id="newEmpDay">${ds}</select></div>
    </div>
    <div class="info-box">Entra con la semana en Libre. Tú asignas sus turnos sin tocar al resto del equipo.</div>
    <div style="display:flex;gap:6px;margin-top:8px">
      <button class="action-btn" onclick="window.openEmployeesEditor()">← Volver</button>
      <button class="action-btn primary" onclick="window.confirmAddEmployee()" style="flex:1">Añadir</button>
    </div>
  `;
}

export function confirmAddEmployee() {
  const n = document.getElementById('newEmpName').value.trim();
  if (!n) { log('Nombre vacío', 'err'); return; }
  if (store.EMPLOYEES.some(e => e.name.toLowerCase() === n.toLowerCase())) {
    log(`"${n}" ya existe`, 'err'); return;
  }
  const fd = parseInt(document.getElementById('newEmpDay').value);

  // Insertar empleado al final, y añadir una fila OFF en TODAS las semanas
  // (actual + las guardadas) para mantener la estructura consistente sin
  // tocar los horarios ya editados de los demás.
  store.EMPLOYEES.push({ name: n, freeDay: fd });
  mutateAllSchedules(
    (sched) => sched.push(makeOffRow()),
    (edited) => edited.push(Array(7).fill(false))
  );

  log(`Añadido: ${n} (libre ${DF[fd]}) · semana en Libre`, 'ok');
  saveState();
  render();
  openEmployeesEditor();
}

export function openEmployeeEdit(idx) {
  const e = store.EMPLOYEES[idx];
  document.getElementById('modalTitle').textContent = `Editar: ${e.name}`;
  const ds = [0, 1, 2, 3, 4].map(d => `<option value="${d}" ${e.freeDay === d ? 'selected' : ''}>${DF[d]}</option>`).join('');
  
  document.getElementById('modalBody').innerHTML = `
    <div class="edit-grid">
      <label>Nombre</label><div class="editor-row"><input type="text" id="edEmpName" value="${esc(e.name)}"/></div>
      <label>Día libre</label><div class="editor-row"><select id="edEmpDay">${ds}</select></div>
    </div>
    <div class="info-box">Cambiar el día libre solo actualiza la etiqueta; no toca el horario asignado. Si necesitas cambiar turnos, edita celda por celda.</div>
    <div style="display:flex;gap:6px;margin-top:8px">
      <button class="action-btn" onclick="window.openEmployeesEditor()">← Volver</button>
      <button class="action-btn primary" onclick="window.saveEmployeeEdit(${idx})" style="flex:1">Guardar</button>
    </div>
  `;
}

export function saveEmployeeEdit(idx) {
  const n = document.getElementById('edEmpName').value.trim();
  const nd = parseInt(document.getElementById('edEmpDay').value);
  if (!n) { log('Nombre vacío', 'err'); return; }
  if (store.EMPLOYEES.some((e, i) => i !== idx && e.name.toLowerCase() === n.toLowerCase())) {
    log(`"${n}" ya existe`, 'err'); return;
  }

  const old = store.EMPLOYEES[idx];
  const dayChanged = old.freeDay !== nd;
  const nameChanged = old.name !== n;

  store.EMPLOYEES[idx] = { name: n, freeDay: nd };

  // Ya NO regeneramos el horario al cambiar el día libre: respetar las
  // ediciones manuales del admin. Si el nuevo día libre choca con un turno
  // asignado, el admin lo verá y lo corregirá manualmente.
  if (dayChanged && nameChanged) {
    log(`${n}: ${old.name} → ${n}, libre → ${DF[nd]}`, 'warn');
  } else if (dayChanged) {
    log(`${n}: libre → ${DF[nd]} (horario sin tocar)`, 'warn');
  } else if (nameChanged) {
    log(`Nombre: ${old.name} → ${n}`, 'ok');
  }

  saveState();
  render();
  openEmployeesEditor();
}

export function deleteEmployee(idx) {
  if (store.EMPLOYEES.length <= 1) {
    log('No puedes eliminar al último', 'err');
    return;
  }
  const n = store.EMPLOYEES[idx].name;

  // Quitar solo la fila de este empleado en todas las semanas. El horario
  // del resto del equipo se mantiene intacto.
  store.EMPLOYEES.splice(idx, 1);
  mutateAllSchedules(
    (sched) => { if (sched.length > idx) sched.splice(idx, 1); },
    (edited) => { if (edited.length > idx) edited.splice(idx, 1); }
  );

  log(`Eliminado: ${n}`, 'warn');
  saveState();
  render();
  openEmployeesEditor();
}
