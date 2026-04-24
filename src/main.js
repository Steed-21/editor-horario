import './styles/main.css';
import { regenSchedule } from './domain/schedule.js';
import { setupEvents } from './controllers/events.js';
import { render } from './ui/layout.js';
import { renderLog } from './ui/components/log.js';

regenSchedule();
setupEvents();
render();
renderLog();
