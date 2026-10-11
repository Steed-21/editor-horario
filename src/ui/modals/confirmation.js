import { store } from '../../state/store.js';
import { esc } from '../../utils/escape.js';
import { openModal } from './modal.js';

export function openConfirmation({ title, messages, typed = false, onConfirm, onCancel }) {
  if (!store.isAdmin) return;
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = `
    <div id="confirmationError" class="editor-error" role="alert"></div>
    ${messages.map(message => `<div class="info-box">${esc(message)}</div>`).join('')}
    ${typed ? `<div class="edit-grid"><label for="destructiveConfirmation">Escribe ELIMINAR</label>
      <div class="editor-row"><input id="destructiveConfirmation" type="text" autocomplete="off" spellcheck="false" autofocus></div></div>` : ''}
    <div class="editor-footer">
      <button id="cancelConfirmation" type="button" class="action-btn">Cancelar</button>
      <button id="applyConfirmation" type="button" class="action-btn primary" ${typed ? 'disabled' : ''}>${typed ? 'Confirmar eliminación' : 'Confirmar sustitución'}</button>
    </div>`;
  const input = document.getElementById('destructiveConfirmation');
  const apply = document.getElementById('applyConfirmation');
  const cancel = document.getElementById('cancelConfirmation');
  let pending = false;
  input?.addEventListener('input', () => { apply.disabled = pending || input.value !== 'ELIMINAR'; });
  cancel.addEventListener('click', onCancel);
  apply.addEventListener('click', async () => {
    if (pending || apply.disabled || !store.isAdmin || (typed && input?.value !== 'ELIMINAR')) return;
    pending = true; apply.disabled = true; cancel.disabled = true;
    if (input) input.disabled = true;
    const editor = store.activeEditor;
    const result = await onConfirm(typed ? input.value : undefined);
    // Navigation, snapshots and auth may invalidate this confirmation while awaiting.
    if (!store.isAdmin || store.activeEditor !== editor) return;
    if (result.ok) { onCancel(); return; }
    document.getElementById('confirmationError').textContent = result.error;
    pending = false; cancel.disabled = false;
    if (input) input.disabled = false;
    apply.disabled = typed && input?.value !== 'ELIMINAR';
  });
  openModal();
}
