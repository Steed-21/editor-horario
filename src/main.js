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
    if (store.schedule.length === 0) regenSchedule();
    setupEvents();
    initialLoad = false;
  }
  render();
  renderLog();
});
