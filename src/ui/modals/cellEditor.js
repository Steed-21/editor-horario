import { ensureRosterHistory, getWeekEmployees, store, isLegacyWeek } from '../../state/store.js';
import { DF } from '../../config/constants.js';
import { shiftGrossHours, shiftNetHours, usableShift, usableCell } from '../../domain/shift.js';
import { cellHours, makeCell } from '../../domain/cell.js';
import { log } from '../components/log.js';
import { openModal, closeModal } from './modal.js';
import { render } from '../layout.js';
import { formatHour } from '../../domain/dateUtils.js';
import { saveState } from '../../state/store.js';
import { esc, jsArg } from '../../utils/escape.js';

export function openCellEditor(pi, di) {
  ensureRosterHistory();
  if (!store.isAdmin || (isLegacyWeek() || store.weekStatus === 'legacy') || !store.schedule[pi]?.[di]) return;
  store.editorInvalidated = false;
  store.activeEditor = null;
  store.currentEdit = { pi, di, draft: { ...store.schedule[pi][di] } };
  renderCellModal(store.schedule[pi][di]);
  openModal();
}

export function renderCellModal(cell) {
  document.getElementById('modalTitle').textContent = `${getWeekEmployees()[store.currentEdit.pi].name} · ${DF[store.currentEdit.di]} ${store.currentDates[store.currentEdit.di].str}`;
  const ids = Object.keys(store.SH).filter(id => usableShift(id, store.SH[id]));
  const opts = ids.map(id => {
    const sh = store.SH[id];
    const sel = cell.id === id ? ' selected' : '';
    const lb = sh.start === sh.end ? sh.abbr || sh.name : `${formatHour(sh.start)}–${formatHour(sh.end)}`;
    const gh = shiftGrossHours(sh);
    const nh = shiftNetHours(sh);
    const hText = sh.start === sh.end ? 'Turno sin horas' : (sh.defaultBs != null ? `${nh}h netas (${gh}h bruto)` : `${nh}h`);
    return `<button class="shift-opt ${esc(sh.cls)}${sel}" onclick="window.selectShiftForCell(${jsArg(id)})"><span class="opt-time">${esc(sh.abbr || id)} · ${esc(lb)}</span><span class="opt-h">${esc(sh.name)}${hText ? ' · ' + hText : ''}</span></button>`;
  }).join('');

  const sh = store.SH[cell.id];
  const canBrk = sh.id !== 'OFF' && (sh.end - sh.start) >= 2;
  const bsMin = sh.start;
  const bsMax = sh.end - 1;
  const brkA = cell.bs != null;
  const netH = cellHours(cell);

  const brkS = (sh.start === sh.end) ? `
    <div class="info-box"><strong>Turno sin horas</strong> (Libre/Baja)</div>
  ` : `
    <div class="section-title">Descanso individual</div>
    <div class="edit-grid">
      <label>Descanso</label>
      <div class="break-toggle">
        <input type="checkbox" id="cellBrk" ${brkA ? 'checked' : ''} ${!canBrk ? 'disabled' : ''} onchange="window.toggleCellBreak()"/>
        <label for="cellBrk" style="text-transform:none;letter-spacing:0">${canBrk ? 'Incluir descanso' : 'Turno corto'}</label>
      </div>
      ${brkA ? `<label>Inicio/Dur.</label><div class="editor-row" style="gap:4px">
        <input type="number" step="0.5" id="cellBs" min="${esc(bsMin)}" max="${bsMax}" value="${esc(cell.bs)}" onchange="window.updateCellBreak()" style="width:60px"/>
        <select id="cellBd" onchange="window.updateCellBreak()">
          <option value="1" ${(cell.bd||1) !== 0.5 ? 'selected' : ''}>1h</option>
          <option value="0.5" ${(cell.bd||1) === 0.5 ? 'selected' : ''}>30m</option>
        </select>
        <span style="font-size:10px;color:var(--text-tertiary)">→ ${formatHour(cell.bs + (cell.bd||1))}</span>
      </div>` : ''}
    </div>
    <div class="info-box"><strong>Horas netas:</strong> ${netH}h (${sh.end - sh.start}h bruto${brkA ? ' − ' + ((cell.bd||1)===0.5?'30m':'1h') + ' descanso' : ''})</div>
  `;

  document.getElementById('modalBody').innerHTML = `
    <div class="section-title">Turno</div>
    <div class="shift-opts">${opts}</div>
    ${brkS}
    <div style="margin-top:.75rem"><button class="action-btn primary" onclick="window.confirmCellEdit()" style="width:100%">Aplicar cambios</button></div>
  `;
}

export function selectShiftForCell(newId) {
  if (!store.isAdmin || (isLegacyWeek() || store.weekStatus === 'legacy') || !store.currentEdit || !usableShift(newId, store.SH[newId])) return;
  store.currentEdit.draft = makeCell(newId);
  renderCellModal(store.currentEdit.draft);
}

export function toggleCellBreak() {
  if (!store.isAdmin || (isLegacyWeek() || store.weekStatus === 'legacy') || !store.currentEdit) return;
  const ck = document.getElementById('cellBrk').checked;
  const cell = store.currentEdit.draft;
  const sh = store.SH[cell.id];
  
  if (ck) {
    cell.bs = sh.defaultBs != null ? sh.defaultBs : sh.start + Math.floor((sh.end - sh.start) / 2);
    cell.bd = sh.defaultBd != null ? sh.defaultBd : 1;
  } else {
    cell.bs = null;
    cell.bd = 1;
  }
  
  if (usableCell(cell, store.SH)) renderCellModal(cell);
}

export function updateCellBreak() {
  if (!store.isAdmin || (isLegacyWeek() || store.weekStatus === 'legacy') || !store.currentEdit) return;
  const bs = parseFloat(document.getElementById('cellBs').value);
  const bd = parseFloat(document.getElementById('cellBd').value);
  const cell = store.currentEdit.draft;
  const sh = store.SH[cell.id];
  if (Number.isFinite(bs) && (bd === 0.5 || bd === 1) && bs >= sh.start && bs + bd <= sh.end) {
    cell.bs = bs;
    cell.bd = bd;
    renderCellModal(cell);
  }
}

export function confirmCellEdit() {
  if (!store.isAdmin || (isLegacyWeek() || store.weekStatus === 'legacy') || !store.currentEdit) return;
  const { pi, di, draft } = store.currentEdit;
  if (!usableCell(draft, store.SH)) { log('Datos de celda inválidos', 'err'); return; }
  const cell = { ...draft };
  store.schedule[pi][di] = cell;
  store.edited[pi][di] = true;
  // Clear the draft before any listener or repeated Apply can run.
  closeModal();
  const bt = cell.bs != null ? ` ⏸${formatHour(cell.bs)}–${formatHour(cell.bs + (cell.bd||1))}` : ' sin⏸';
  log(`${getWeekEmployees()[pi].name} · ${DF[di].slice(0, 3)}: ${cell.id}${bt} (${cellHours(cell)}h)`, 'ok');
  saveState();
  render();
}
