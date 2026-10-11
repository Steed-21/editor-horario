import './styles/main.css';
import { setupEvents } from './controllers/events.js';
import { render } from './ui/layout.js';
import { setupOperationalGrid } from './ui/operationalGrid.js';

const stopOperationalGrid = setupOperationalGrid(document.querySelector('.container'), document.getElementById('operationalGrid'));
if (import.meta.hot) import.meta.hot.dispose(stopOperationalGrid);
window._renderUI = render;
setupEvents();
render();
