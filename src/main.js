import './styles/main.css';
import { regenSchedule } from './domain/schedule.js';
import { setupEvents } from './controllers/events.js';
import { render } from './ui/layout.js';
import { renderLog } from './ui/components/log.js';
import { syncState, store } from './state/store.js';

window._renderUI = render;
let initialLoad = true;

syncState(() => {
  if (initialLoad) {
    // Solo regenerar si no hay datos guardados (ni en memoria ni en semanas).
    // Si store.weeks tiene entradas, significa que Firebase tiene datos reales
    // que llegarán en los próximos ms. Regenerar ahora sobreescribiría el horario.
    const hasWeeks = store.weeks && Object.keys(store.weeks).length > 0;
    if (store.schedule.length === 0 && !hasWeeks) regenSchedule();
    setupEvents();
    initialLoad = false;
  }
  render();
  renderLog();
});
