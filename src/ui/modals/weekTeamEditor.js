import { store, getCurrentWeekStr, getWeekEmployees, mutateWeekRoster, isLegacyWeek } from '../../state/store.js';
import { classifyWeek, weekCandidates, usableWeekTeam } from '../../domain/weekRoster.js';
import { esc } from '../../utils/escape.js';
import { openModal } from './modal.js';

export function openWeekTeamEditor() {
  if (!store.isAdmin) return;
  const key = getCurrentWeekStr();
  let kind;
  try { kind = classifyWeek(key); } catch (_error) { kind = 'invalid'; }
  const roster = getWeekEmployees();
  const valid = !isLegacyWeek(key) && !['missing', 'legacy', 'invalid'].includes(store.weekStatus)
    && usableWeekTeam(store.weekRosters[key], store.weeks[key], store.SH);
  const editable = valid && kind !== 'past' && kind !== 'invalid';
  const busy = store.pendingWrite != null;
  const candidates = weekCandidates(store.EMPLOYEES, roster);
  const options = candidates.map(e => `<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('');
  const rows = roster.map((employee, index) => `
    <div class="emp-item week-team-row">
      <div class="emp-name">${esc(employee?.name || 'Atribución desconocida')}</div>
      ${editable && kind === 'future' ? `
        ${options ? `<div class="edit-grid">
          <label for="weekReplace${index}">Sustituir por</label>
          <div class="editor-row"><select id="weekReplace${index}" aria-label="Sustituir ${esc(employee.name)} por" ${busy ? 'disabled' : ''}>${options}</select></div>
        </div>` : ''}
        <div class="editor-footer">
          ${options ? `<button type="button" class="action-btn" data-week-operation="replace" data-target="${esc(employee.id)}" data-select="weekReplace${index}" ${busy ? 'disabled' : ''}>Sustituir</button>` : ''}
          <button type="button" class="action-btn" data-week-operation="remove" data-target="${esc(employee.id)}" ${busy || roster.length === 1 ? 'disabled' : ''}>Quitar</button>
        </div>` : ''}
    </div>`).join('');
  store.currentEdit = null;
  store.activeEditor = { kind: 'week-team', week: key };
  store.editorInvalidated = false;
  document.getElementById('modalTitle').textContent = `Equipo · ${key}`;
  document.getElementById('modalBody').innerHTML = `
    <div id="weekTeamError" class="editor-error" role="alert"></div>
    <div class="info-box">Los cambios aquí afectan solo esta semana. Para futuras semanas usa Equipo general.</div>
    ${kind === 'past' ? '<p>Histórico: el equipo de esta semana está bloqueado.</p>' : ''}
    ${!valid ? '<p>Equipo no editable: semana ausente, inválida o con atribución inconsistente.</p>' : ''}
    ${editable ? '<p>Se añade con la semana en libre. Asigna manualmente los turnos que correspondan.</p>' : ''}
    ${editable && kind === 'current' ? '<p>Esta semana solo permite añadir. No se permite sustituir ni quitar empleados.</p>' : ''}
    <div class="emp-list editor-list">${rows}</div>
    ${editable && !options ? '<p>No hay empleados activos disponibles fuera de este equipo.</p>' : ''}
    ${editable && options ? `<div class="edit-grid">
      <label for="weekAddCandidate">Empleado para añadir</label>
      <div class="editor-row"><select id="weekAddCandidate" ${busy ? 'disabled' : ''}>${options}</select></div>
    </div><div class="editor-footer">
      <button type="button" class="action-btn" data-week-operation="add" data-select="weekAddCandidate" ${busy ? 'disabled' : ''}>Añadir</button>
    </div>` : ''}
    ${busy ? '<p role="status">Guardando…</p>' : ''}
    ${editable && kind === 'future' ? '<p>Sustituir conserva los turnos de la fila. Quitar elimina solo esa fila. No se puede quitar al último empleado.</p>' : ''}
  `;
  document.getElementById('modalBody').querySelectorAll?.('[data-week-operation]').forEach(button => {
    button.addEventListener('click', async () => {
      if (button.disabled) return;
      const candidateId = button.dataset.select ? document.getElementById(button.dataset.select)?.value : undefined;
      const controls = document.getElementById('modalBody').querySelectorAll('button, select');
      controls.forEach(control => { control.disabled = true; });
      const result = await mutateWeekRoster({ week: key, operation: button.dataset.weekOperation, targetId: button.dataset.target, candidateId });
      if (!store.isAdmin || getCurrentWeekStr() !== key || store.activeEditor?.kind !== 'week-team') return;
      openWeekTeamEditor();
      if (!result.ok) document.getElementById('weekTeamError').textContent = result.error;
    });
  });
  openModal();
}
