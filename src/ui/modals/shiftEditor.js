import { store, saveState } from '../../state/store.js';
import { shiftGrossHours, shiftNetHours } from '../../domain/shift.js';
import { log } from '../components/log.js';
import { openModal } from './modal.js';
import { render } from '../layout.js';
import { formatHour } from '../../domain/dateUtils.js';

export function openShiftBaseEditor() {
  document.getElementById('modalTitle').textContent = 'Editar turnos base';
  const ids = Object.keys(store.SH).filter(id => id !== 'OFF');
  const rows = ids.map(id => {
    const sh = store.SH[id];
    const lb = sh.start === sh.end ? sh.abbr || sh.name : `${formatHour(sh.start)}–${formatHour(sh.end)}`;
    const gh = shiftGrossHours(sh);
    const nh = shiftNetHours(sh);
    const brkTxt = sh.start === sh.end 
      ? `<span class="net">Turno sin horas</span>`
      : (sh.defaultBs != null 
        ? `<span class="net">${nh}h netas</span> · ${gh}h brutas · ⏸def ${formatHour(sh.defaultBs)}–${formatHour(sh.defaultBs + (sh.defaultBd||1))}` 
        : `<span class="net">${nh}h</span> · sin descanso`);
    const db = !sh.builtin ? `<button class="del" onclick="window.deleteShift('${id}')">×</button>` : '<span style="width:24px"></span>';
    
    return `<div class="shift-item ${sh.builtin ? '' : 'custom'} ${sh.cls}">
      <span class="sh-id">${id}</span>
      <span class="sh-info"><strong>${sh.name}</strong> (${sh.abbr || sh.id}) · ${lb}<br>${brkTxt}</span>
      <button onclick="window.openSingleShiftEditor('${id}')">Editar</button>
      ${db}
    </div>`;
  }).join('');

  document.getElementById('modalBody').innerHTML = `
    <button class="new-shift-btn" onclick="window.createCustomShift()">+ Crear turno nuevo</button>
    <div class="info-box"><strong>Netas = Brutas − 1h descanso</strong> (si aplica). El descanso por defecto se descuenta automáticamente.</div>
    <div class="shift-list" style="margin-top:.75rem">${rows}</div>
  `;
  openModal();
}

export function createCustomShift() {
  store.customCounter++;
  let id = `X${store.customCounter}`;
  while (store.SH[id]) {
    store.customCounter++;
    id = `X${store.customCounter}`;
  }
  store.SH[id] = { id, abbr: id, cls: 'tCUSTOM', start: 0, end: 0, defaultBs: null, defaultBd: 1, name: 'Baja/Ausencia', builtin: false };
  log(`Custom: ${id}`, 'ok');
  openSingleShiftEditor(id);
}

export function deleteShift(id) {
  let used = false;
  for (let pi = 0; pi < store.EMPLOYEES.length; pi++) {
    for (let di = 0; di < 7; di++) {
      if (store.schedule[pi][di].id === id) used = true;
    }
  }
  if (used) {
    log(`No se puede eliminar ${id}: en uso`, 'err');
    return;
  }
  delete store.SH[id];
  log(`Turno ${id} eliminado`, 'warn');
  openShiftBaseEditor();
  saveState();
  render();
}

export function openSingleShiftEditor(id) {
  const sh = store.SH[id];
  const gh = shiftGrossHours(sh);
  const nh = shiftNetHours(sh);
  document.getElementById('modalTitle').textContent = `Editar turno ${id}`;
  
  const nf = `<label>Abrev.</label><div class="editor-row"><input type="text" id="edAbbr" value="${sh.abbr || sh.id}" style="width:140px"/></div>
              <label>Nombre</label><div class="editor-row"><input type="text" id="edName" value="${sh.name}" style="width:140px"/></div>`;
  
  document.getElementById('modalBody').innerHTML = `
    <div class="edit-grid">
      ${nf}
      <label>Inicio</label><div class="editor-row"><input type="number" step="0.5" id="edStart" min="0" max="23.5" value="${sh.start}" oninput="window.previewShiftHours()"/></div>
      <label>Fin</label><div class="editor-row"><input type="number" step="0.5" id="edEnd" min="0.5" max="24" value="${sh.end}" oninput="window.previewShiftHours()"/></div>
      <label>⏸ por defecto</label>
      <div class="editor-row" style="gap:4px">
        <input type="number" step="0.5" id="edDefBs" min="0" max="23.5" value="${sh.defaultBs != null ? sh.defaultBs : ''}" placeholder="sin" oninput="window.previewShiftHours()" style="width:60px"/>
        <select id="edDefBd" onchange="window.previewShiftHours()">
          <option value="1" ${sh.defaultBd !== 0.5 ? 'selected' : ''}>1 hora</option>
          <option value="0.5" ${sh.defaultBd === 0.5 ? 'selected' : ''}>30 min</option>
        </select>
      </div>
    </div>
    <div class="info-box" id="hoursPreview"><strong>${nh}h netas</strong> · ${gh}h brutas${sh.defaultBs != null ? ' · descanso ' + formatHour(sh.defaultBs) + '–' + formatHour(sh.defaultBs + (sh.defaultBd||1)) : ' · sin descanso'}</div>
    <div style="display:flex;gap:6px;margin-top:8px">
      <button class="action-btn" onclick="window.openShiftBaseEditor()">← Volver</button>
      <button class="action-btn primary" onclick="window.saveShiftEdit('${id}')" style="flex:1">Guardar</button>
    </div>
  `;
}

export function previewShiftHours() {
  const s = parseFloat(document.getElementById('edStart').value);
  const e = parseFloat(document.getElementById('edEnd').value);
  const dbr = document.getElementById('edDefBs').value;
  const db = dbr === '' ? null : parseFloat(dbr);
  const bd = parseFloat(document.getElementById('edDefBd').value);
  
  if (isNaN(s) || isNaN(e) || s > e) {
    document.getElementById('hoursPreview').innerHTML = '<span class="err">Rango inválido</span>';
    return;
  }
  const gh = e - s;
  const hasBrk = db != null && !isNaN(db) && db >= s && db < e;
  const nh = Math.max(0, gh - (hasBrk ? bd : 0));
  
  if (gh === 0) {
    document.getElementById('hoursPreview').innerHTML = `<strong>Turno sin horas</strong> (Libre/Baja)`;
  } else {
    document.getElementById('hoursPreview').innerHTML = `<strong>${nh}h netas</strong> · ${gh}h brutas${hasBrk ? ' · descanso ' + formatHour(db) + '–' + formatHour(db+bd) : ' · sin descanso'}`;
  }
}

export function saveShiftEdit(id) {
  const sh = store.SH[id];
  const s = parseFloat(document.getElementById('edStart').value);
  const e = parseFloat(document.getElementById('edEnd').value);
  const dbr = document.getElementById('edDefBs').value;
  const db = dbr === '' ? null : parseFloat(dbr);
  
  if (isNaN(s) || isNaN(e) || s > e) {
    log(`Error ${id}: rango inválido`, 'err');
    return;
  }
  if (db != null && (db < s || db >= e)) {
    log(`Error ${id}: descanso fuera del turno`, 'err');
    return;
  }
  
  const bd = parseFloat(document.getElementById('edDefBd').value);
  
  store.SH[id].start = s;
  store.SH[id].end = e;
  store.SH[id].defaultBs = db;
  store.SH[id].defaultBd = bd;
  
  const abbr = document.getElementById('edAbbr').value.trim();
  const nn = document.getElementById('edName').value.trim();
  if (abbr) store.SH[id].abbr = abbr;
  if (nn) store.SH[id].name = nn;
  
  const gh = e - s;
  const nh = Math.max(0, gh - (db != null ? bd : 0));
  log(`Turno ${id}: ${formatHour(s)}–${formatHour(e)} · ${nh}h netas (${gh}h brutas)`, 'warn');
  
  saveState();
  render();
  openShiftBaseEditor();
}
