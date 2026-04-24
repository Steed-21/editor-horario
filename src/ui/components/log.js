import { store } from '../../state/store.js';

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
    `<div class="log-entry"><span class="log-time">[${e.ts}]</span><span class="log-msg ${e.type}">${e.msg}</span></div>`
  ).join('');
}
