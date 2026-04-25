import { store, saveState } from '../../state/store.js';
import { DF } from '../../config/constants.js';
import { log } from '../components/log.js';
import { regenSchedule } from '../../domain/schedule.js';
import { openModal } from './modal.js';
import { render } from '../layout.js';

export function openEmployeesEditor() {
  document.getElementById('modalTitle').textContent = 'Gestión de empleados';
  const rows = store.EMPLOYEES.map((e, i) => `
    <div class="emp-item">
      <div>
        <div class="emp-name">${e.name}</div>
        <div class="emp-day">Libre: ${DF[e.freeDay]}</div>
      </div>
      <button onclick="window.openEmployeeEdit(${i})">Editar</button>
      <button class="del" onclick="window.deleteEmployee(${i})">×</button>
      <span style="width:4px"></span>
    </div>
  `).join('');

  document.getElementById('modalBody').innerHTML = `
    <button class="new-shift-btn" onclick="window.openEmployeeAdd()">+ Añadir empleado</button>
    <div class="info-box">Al añadir o quitar personas se regenera el horario.</div>
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
    <div class="info-box">El nuevo empleado entrará con horario auto-generado.</div>
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
  store.EMPLOYEES.push({ name: n, freeDay: fd });
  regenSchedule();
  log(`Añadido: ${n} (libre ${DF[fd]})`, 'ok');
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
      <label>Nombre</label><div class="editor-row"><input type="text" id="edEmpName" value="${e.name}"/></div>
      <label>Día libre</label><div class="editor-row"><select id="edEmpDay">${ds}</select></div>
    </div>
    <div class="info-box">Cambiar día libre regenera el horario de esta persona.</div>
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
  const dc = old.freeDay !== nd;
  const nc = old.name !== n;
  
  store.EMPLOYEES[idx] = { name: n, freeDay: nd };
  if (dc) {
    regenSchedule();
    log(`${n}: libre → ${DF[nd]} (regenerado)`, 'warn');
  } else if (nc) {
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
  store.EMPLOYEES.splice(idx, 1);
  regenSchedule();
  log(`Eliminado: ${n}`, 'warn');
  saveState();
  render();
  openEmployeesEditor();
}
