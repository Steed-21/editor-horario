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
  logPanel.innerHTML = store.logEntries.map(e => 
    `<div class="log-entry"><span class="log-time">[${esc(e.ts)}]</span><span class="log-msg ${esc(e.type)}">${esc(e.msg)}</span></div>`
  ).join('');
}
