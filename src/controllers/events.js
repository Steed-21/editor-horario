import { store } from '../state/store.js';
import { regenSchedule } from '../domain/schedule.js';
import { validate } from '../domain/validation.js';
import { log } from '../ui/components/log.js';
import { render } from '../ui/layout.js';
import { closeModal } from '../ui/modals/modal.js';
import { openShiftBaseEditor } from '../ui/modals/shiftEditor.js';
import { openEmployeesEditor } from '../ui/modals/empEditor.js';
import { DEFAULT_SHIFTS } from '../config/shifts.js';
import { DEFAULT_EMPLOYEES } from '../config/employees.js';

import { openCellEditor, selectShiftForCell, toggleCellBreak, updateCellBreak, confirmCellEdit } from '../ui/modals/cellEditor.js';
import { createCustomShift, deleteShift, openSingleShiftEditor, previewShiftHours, saveShiftEdit } from '../ui/modals/shiftEditor.js';
import { openEmployeeAdd, confirmAddEmployee, openEmployeeEdit, saveEmployeeEdit, deleteEmployee } from '../ui/modals/empEditor.js';

export function setupEvents() {
  window.openCellEditor = openCellEditor;
  window.selectShiftForCell = selectShiftForCell;
  window.toggleCellBreak = toggleCellBreak;
  window.updateCellBreak = updateCellBreak;
  window.confirmCellEdit = confirmCellEdit;
  
  window.openShiftBaseEditor = openShiftBaseEditor;
  window.createCustomShift = createCustomShift;
  window.deleteShift = deleteShift;
  window.openSingleShiftEditor = openSingleShiftEditor;
  window.previewShiftHours = previewShiftHours;
  window.saveShiftEdit = saveShiftEdit;
  
  window.openEmployeesEditor = openEmployeesEditor;
  window.openEmployeeAdd = openEmployeeAdd;
  window.confirmAddEmployee = confirmAddEmployee;
  window.openEmployeeEdit = openEmployeeEdit;
  window.saveEmployeeEdit = saveEmployeeEdit;
  window.deleteEmployee = deleteEmployee;

  document.getElementById('modalClose')?.addEventListener('click', closeModal);
  document.getElementById('modalBg')?.addEventListener('click', e => {
    if(e.target.id === 'modalBg') closeModal();
  });

  document.getElementById('bPrev')?.addEventListener('click', () => {
    if(store.wo > 0) {
      store.wo--;
      regenSchedule();
      log(`SEMANA_${store.wo + 1}`, 'info');
      render();
    }
  });

  document.getElementById('bNext')?.addEventListener('click', () => {
    store.wo++;
    regenSchedule();
    log(`SEMANA_${store.wo + 1}`, 'info');
    render();
  });

  document.getElementById('bReset')?.addEventListener('click', () => {
    store.SH = JSON.parse(JSON.stringify(DEFAULT_SHIFTS));
    store.EMPLOYEES = JSON.parse(JSON.stringify(DEFAULT_EMPLOYEES));
    store.customCounter = 0;
    regenSchedule();
    log('Estado completo restablecido', 'info');
    render();
  });

  document.getElementById('bLock')?.addEventListener('click', () => {
    const v = validate();
    if(v.allH && v.cierre_ok && v.apertura_ok) log('Horario confirmado · OK', 'ok');
    else log(`Horario con ${v.violations.length} incidencia(s)`, 'err');
  });

  document.getElementById('bEditShifts')?.addEventListener('click', openShiftBaseEditor);
  document.getElementById('bEditEmps')?.addEventListener('click', openEmployeesEditor);

  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      store.view = t.dataset.view;
      render();
    });
  });
}
