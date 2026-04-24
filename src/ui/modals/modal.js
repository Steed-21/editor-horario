import { store } from '../../state/store.js';

export function openModal() {
  document.getElementById('modalBg').style.display = 'flex';
}

export function closeModal() {
  document.getElementById('modalBg').style.display = 'none';
  store.currentEdit = null;
}
