import { store } from '../../state/store.js';

let session;
const controls = 'a[href], button, input, select, textarea, [tabindex]';
function focusable(node, tabbable = true) {
  return !!node?.isConnected && !node.disabled && !node.matches?.(':disabled') && (!tabbable || node.tabIndex >= 0)
    && !node.closest('[hidden], [inert]') && node.getClientRects().length > 0;
}
export function openModal() {
  const overlay = document.getElementById('modalBg');
  const dialog = document.getElementById('modalBox');
  overlay.style.display = 'flex';
  if (!dialog || !document.addEventListener) return;
  if (session) { session.focusInside(); return; }
  const owner = document;
  const trigger = owner.activeElement;
  const siblings = [...overlay.parentElement.children].filter(node => node !== overlay)
    .map(node => ({ node, inert: node.inert }));
  siblings.forEach(({ node }) => { node.inert = true; });
  const candidates = () => [...dialog.querySelectorAll(controls)].filter(node => focusable(node));
  const focusInside = () => {
    const autofocus = dialog.querySelector('[autofocus]');
    const close = owner.getElementById('modalClose');
    (focusable(autofocus, false) ? autofocus : candidates()[0] || (focusable(close, false) ? close : dialog)).focus();
  };
  const containFocus = () => {
    if (!dialog.contains(owner.activeElement)) focusInside();
  };
  const onKey = event => {
    if (event.key === 'Escape') { event.preventDefault(); closeModal(); return; }
    if (event.key !== 'Tab') return;
    const items = candidates();
    const first = items[0], last = items.at(-1);
    if (!first || !dialog.contains(owner.activeElement)
      || (event.shiftKey && (owner.activeElement === first || owner.activeElement === dialog))
      || (!event.shiftKey && (owner.activeElement === last || owner.activeElement === dialog))) {
      event.preventDefault();
      (event.shiftKey ? last || dialog : first || dialog).focus();
    }
  };
  const observer = new MutationObserver(() => {
    if (overlay.style.display === 'none') closeModal();
    else containFocus();
  });
  session = { focusInside, release() {
    observer.disconnect();
    owner.removeEventListener('keydown', onKey);
    owner.removeEventListener('focusin', containFocus);
    siblings.forEach(({ node, inert }) => { node.inert = inert; });
    if (focusable(trigger, false)) trigger.focus();
  } };
  owner.addEventListener('keydown', onKey);
  owner.addEventListener('focusin', containFocus);
  observer.observe(overlay, { attributes: true, attributeFilter: ['style'], childList: true, subtree: true });
  focusInside();
}

export function closeModal() {
  document.getElementById('modalBg').style.display = 'none';
  store.currentEdit = null;
  store.activeEditor = null;
  const previous = session;
  session = null;
  previous?.release();
}
