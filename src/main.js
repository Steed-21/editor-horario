import './styles/main.css';
import { setupEvents } from './controllers/events.js';
import { render } from './ui/layout.js';

window._renderUI = render;
setupEvents();
render();
