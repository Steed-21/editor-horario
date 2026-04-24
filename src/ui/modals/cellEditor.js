import { store } from '../../state/store.js';
import { DF } from '../../config/constants.js';
import { shiftGrossHours, shiftNetHours } from '../../domain/shift.js';
import { cellHours, makeCell } from '../../domain/cell.js';
import { log } from '../components/log.js';
import { openModal, closeModal } from './modal.js';
import { render } from '../layout.js';

export function openCellEditor(pi, di) {
  store.currentEdit = { pi, di };
  renderCellModal(store.schedule[pi][di]);
  openModal();
}

export function renderCellModal(cell) {
  document.getElementById('modalTitle').textContent = `${store.EMPLOYEES[store.currentEdit.pi].name} · ${DF[store.currentEdit.di]} ${store.currentDates[store.currentEdit.di].str}`;
  const ids = Object.keys(store.SH);
  const opts = ids.map(id => {
    const sh = store.SH[id];
    const sel = cell.id === id ? ' selected' : '';
    const lb = sh.start === sh.end ? sh.abbr || sh.name : `${sh.start}–${sh.end === 24 ? '24' : sh.end}`;
    const gh = shiftGrossHours(sh);
    const nh = shiftNetHours(sh);
    const hText = sh.start === sh.end ? 'Turno sin horas' : (sh.defaultBs != null ? `${nh}h netas (${gh}h bruto)` : `${nh}h`);
    return `<button class="shift-opt ${sh.cls}${sel}" onclick="window.selectShiftForCell('${id}')"><span class="opt-time">${sh.abbr || id} · ${lb}</span><span class="opt-h">${sh.name}${hText ? ' · ' + hText : ''}</span></button>`;
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
        <label for="cellBrk" style="text-transform:none;letter-spacing:0">${canBrk ? 'Incluir 1h de descanso' : 'Turno corto'}</label>
      </div>
      ${brkA ? `<label>Inicio</label><div class="editor-row"><input type="number" id="cellBs" min="${bsMin}" max="${bsMax}" value="${cell.bs}" onchange="window.updateCellBreak()"/><span style="font-size:10px;color:var(--text-tertiary)">:00 → ${cell.bs + 1}:00</span></div>` : ''}
    </div>
    <div class="info-box"><strong>Horas netas:</strong> ${netH}h (${sh.end - sh.start}h bruto${brkA ? ' − 1h descanso' : ''})</div>
  `;

  document.getElementById('modalBody').innerHTML = `
    <div class="section-title">Turno</div>
    <div class="shift-opts">${opts}</div>
    ${brkS}
    <div style="margin-top:.75rem"><button class="action-btn primary" onclick="window.confirmCellEdit()" style="width:100%">Aplicar cambios</button></div>
  `;
}

export function selectShiftForCell(newId) {
  const { pi, di } = store.currentEdit;
  store.schedule[pi][di] = makeCell(newId);
  store.edited[pi][di] = true;
  renderCellModal(store.schedule[pi][di]);
}

export function toggleCellBreak() {
  const { pi, di } = store.currentEdit;
  const ck = document.getElementById('cellBrk').checked;
  const cell = store.schedule[pi][di];
  const sh = store.SH[cell.id];
  cell.bs = ck ? (sh.defaultBs != null ? sh.defaultBs : sh.start + Math.floor((sh.end - sh.start) / 2)) : null;
  store.edited[pi][di] = true;
  renderCellModal(cell);
}

export function updateCellBreak() {
  const { pi, di } = store.currentEdit;
  const bs = parseInt(document.getElementById('cellBs').value);
  const cell = store.schedule[pi][di];
  const sh = store.SH[cell.id];
  if (!isNaN(bs) && bs >= sh.start && bs <= sh.end - 1) {
    cell.bs = bs;
    store.edited[pi][di] = true;
    renderCellModal(cell);
  }
}

export function confirmCellEdit() {
  const { pi, di } = store.currentEdit;
  const cell = store.schedule[pi][di];
  const bt = cell.bs != null ? ` ⏸${cell.bs}–${cell.bs + 1}` : ' sin⏸';
  log(`${store.EMPLOYEES[pi].name} · ${DF[di].slice(0, 3)}: ${cell.id}${bt} (${cellHours(cell)}h)`, 'ok');
  closeModal();
  render();
}
