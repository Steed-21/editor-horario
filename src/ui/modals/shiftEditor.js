import { store, saveState, canUseShiftCatalog, shiftHasHistory, sameData } from '../../state/store.js';
import { shiftGrossHours, shiftNetHours, usableShift } from '../../domain/shift.js';
import { log } from '../components/log.js';
import { openModal } from './modal.js';
import { render } from '../layout.js';
import { formatHour } from '../../domain/dateUtils.js';
import { esc, jsArg } from '../../utils/escape.js';

export function openShiftBaseEditor() {
  store.currentEdit = null;
  store.activeEditor = { kind: 'shifts' };
  store.editorInvalidated = false;
  document.getElementById('modalTitle').textContent = 'Editar turnos base';
  const ids = Object.keys(store.SH).filter(id => id !== 'OFF' && usableShift(id, store.SH[id]));
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
    const db = !sh.builtin ? `<button class="del" aria-label="Eliminar turno ${esc(id)}" onclick="window.deleteShift(${jsArg(id)})">×</button>` : '<span class="row-spacer" aria-hidden="true"></span>';
    
    return `<div class="shift-item ${sh.builtin ? '' : 'custom'} ${esc(sh.cls)}">
      <span class="sh-id">${esc(id)}<span class="shift-origin">${sh.builtin ? 'Base' : 'Custom'}</span></span>
      <span class="sh-info"><strong>${esc(sh.name)}</strong> (${esc(sh.abbr || sh.id)}) · ${esc(lb)}<br>${brkTxt}</span>
      <button onclick="window.openSingleShiftEditor(${jsArg(id)})">Editar</button>
      ${db}
    </div>`;
  }).join('');

  document.getElementById('modalBody').innerHTML = `
    ${Object.entries(store.SH).some(([id, sh]) => !usableShift(id, sh)) ? '<div class="info-box">Catálogo parcial: definiciones inválidas omitidas.</div>' : ''}
    <button class="new-shift-btn" onclick="window.createCustomShift()">+ Crear turno nuevo</button>
    <div class="info-box"><strong>Netas = Brutas − 1h descanso</strong> (si aplica). El descanso por defecto se descuenta automáticamente.</div>
    <div class="shift-list editor-list">${rows}</div>
  `;
  openModal();
}

export function createCustomShift() {
  if (!store.isAdmin) return;
  if (!canUseShiftCatalog(store.SH)) { log('Catálogo incompatible con semanas guardadas', 'err'); return; }
  store.customCounter++;
  let id = `X${store.customCounter}`;
  while (Object.hasOwn(store.SH, id) || shiftHasHistory(id)) {
    store.customCounter++;
    id = `X${store.customCounter}`;
  }
  store.SH[id] = { id, abbr: id, cls: 'tCUSTOM', start: 0, end: 0, defaultBs: null, defaultBd: 1, name: 'Baja/Ausencia', builtin: false };
  log(`Custom: ${id}`, 'ok');
  openSingleShiftEditor(id);
}

export function deleteShift(id) {
  if (!store.isAdmin || !Object.hasOwn(store.SH, id) || !store.SH[id] || store.SH[id].builtin) return;
  const proposed = { ...store.SH };
  delete proposed[id];
  if (!canUseShiftCatalog(proposed)) {
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
  if (!usableShift(id, store.SH[id])) { log('Definición de turno inválida', 'err'); return; }
  store.currentEdit = null;
  store.activeEditor = { kind: 'shift', id };
  store.editorInvalidated = false;
  const sh = store.SH[id];
  const gh = shiftGrossHours(sh);
  const nh = shiftNetHours(sh);
  document.getElementById('modalTitle').textContent = `Editar turno ${id}`;
  
  const nf = `<label for="edAbbr">Abrev.</label><div class="editor-row"><input type="text" id="edAbbr" value="${esc(sh.abbr || sh.id)}"/></div>
              <label for="edName">Nombre</label><div class="editor-row"><input type="text" id="edName" value="${esc(sh.name)}"/></div>`;
  
  document.getElementById('modalBody').innerHTML = `
    <div class="edit-grid">
      ${nf}
      <label for="edStart">Inicio</label><div class="editor-row"><input type="number" step="0.5" id="edStart" min="0" max="23.5" value="${esc(sh.start)}" oninput="window.previewShiftHours()"/></div>
      <label for="edEnd">Fin</label><div class="editor-row"><input type="number" step="0.5" id="edEnd" min="0.5" max="24" value="${esc(sh.end)}" oninput="window.previewShiftHours()"/></div>
      <label for="edDefBs">⏸ por defecto</label>
      <div class="editor-row break-row">
        <input type="number" step="0.5" id="edDefBs" min="0" max="23.5" value="${esc(sh.defaultBs)}" placeholder="sin" oninput="window.previewShiftHours()"/>
        <select aria-label="Duración del descanso por defecto" id="edDefBd" onchange="window.previewShiftHours()">
          <option value="1" ${sh.defaultBd !== 0.5 ? 'selected' : ''}>1 hora</option>
          <option value="0.5" ${sh.defaultBd === 0.5 ? 'selected' : ''}>30 min</option>
        </select>
      </div>
    </div>
    <div class="info-box" id="hoursPreview"><strong>${nh}h netas</strong> · ${gh}h brutas${sh.defaultBs != null ? ' · descanso ' + formatHour(sh.defaultBs) + '–' + formatHour(sh.defaultBs + (sh.defaultBd||1)) : ' · sin descanso'}</div>
    <div class="editor-footer">
      <button class="action-btn" onclick="window.openShiftBaseEditor()">← Volver</button>
      <button class="action-btn primary" onclick="window.saveShiftEdit(${jsArg(id)})">Guardar</button>
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
  if (!store.isAdmin || !usableShift(id, store.SH[id])) return;
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
  
  const proposed = { ...store.SH[id], start: s, end: e, defaultBs: db, defaultBd: bd,
    abbr: document.getElementById('edAbbr').value.trim() || store.SH[id].abbr,
    name: document.getElementById('edName').value.trim() || store.SH[id].name };
  if (!usableShift(id, proposed) || !canUseShiftCatalog({ ...store.SH, [id]: proposed })) {
    log(`Error ${id}: definición o descansos inválidos`, 'err');
    return;
  }
  if (!sameData(store.SH[id], proposed) && shiftHasHistory(id)) {
    log(`Cambio bloqueado: ${id} está en semanas guardadas`, 'err');
    return;
  }
  store.SH[id] = proposed;

  const gh = e - s;
  const nh = Math.max(0, gh - (db != null ? bd : 0));
  log(`Turno ${id}: ${formatHour(s)}–${formatHour(e)} · ${nh}h netas (${gh}h brutas)`, 'warn');
  
  saveState();
  render();
  openShiftBaseEditor();
}
