import { store } from '../../state/store.js';
import { esc } from '../../utils/escape.js';

export function log(msg, type = 'info') {
  const t = new Date();
  const ts = `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}:${String(t.getSeconds()).padStart(2,'0')}`;
  store.logEntries.unshift({ts, msg, type});
  if(store.logEntries.length > 15) store.logEntries.pop();
  renderLog();
}

export function renderLog() {
  const logPanel = document.getElementById('logPanel');
  if(!logPanel) return;
  const severity = {
    info: { marker: '·', label: 'Información' }, ok: { marker: '✓', label: 'Correcto' },
    warn: { marker: '▲', label: 'Advertencia' }, err: { marker: '!', label: 'Error' }
  };
  logPanel.innerHTML = store.logEntries.map(e => {
    const cue = Object.hasOwn(severity, e.type) ? severity[e.type] : severity.info;
    return `<div class="log-entry"><span class="log-time">[${esc(e.ts)}]</span><span class="log-severity" aria-hidden="true">${cue.marker}</span><span class="log-msg ${esc(e.type)}"><span class="sr-only">${cue.label}: </span>${esc(e.msg)}</span></div>`;
  }).join('');
}
