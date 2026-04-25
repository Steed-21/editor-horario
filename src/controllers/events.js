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
import { getMonday } from '../domain/dateUtils.js';
import { getCurrentWeekStr, saveState } from '../state/store.js';
import { auth, signInWithEmailAndPassword, signOut, onAuthStateChanged, googleProvider, signInWithPopup } from '../services/firebase.js';

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

  onAuthStateChanged(auth, (user) => {
    store.isAdmin = !!user;
    const bLogin = document.getElementById('bLogin');
    if (bLogin) {
      if (user) {
        bLogin.textContent = 'Salir';
        bLogin.style.color = '#1D9E75';
      } else {
        bLogin.textContent = 'Admin';
        bLogin.style.color = 'var(--text-secondary)';
      }
    }
    saveState();
  render();
  });

  document.getElementById('bLogin')?.addEventListener('click', () => {
    if (store.isAdmin) {
      signOut(auth);
    } else {
      document.getElementById('loginBg').style.display = 'flex';
      document.getElementById('loginEmail').value = '';
      document.getElementById('loginPwd').value = '';
    }
  });

  document.getElementById('bLoginSubmit')?.addEventListener('click', () => {
    const email = document.getElementById('loginEmail').value;
    const pwd = document.getElementById('loginPwd').value;
    if (!email || !pwd) return;
    
    document.getElementById('bLoginSubmit').textContent = 'Iniciando...';
    signInWithEmailAndPassword(auth, email, pwd)
      .then(() => {
        document.getElementById('loginBg').style.display = 'none';
        document.getElementById('bLoginSubmit').textContent = 'Entrar con Email';
      })
      .catch(err => {
        alert('Error al iniciar sesión: ' + err.message);
        document.getElementById('bLoginSubmit').textContent = 'Entrar con Email';
      });
  });

  document.getElementById('bLoginGoogle')?.addEventListener('click', () => {
    signInWithPopup(auth, googleProvider)
      .then(() => {
        document.getElementById('loginBg').style.display = 'none';
      })
      .catch(err => alert('Error con Google: ' + err.message));
  });

  function navigateWeek(delta, newDateStr = null) {
    store.weeks[getCurrentWeekStr()] = { schedule: store.schedule, edited: store.edited };
    if (newDateStr) {
      store.baseDate = getMonday(newDateStr);
      store.wo = 0;
    } else {
      store.wo += delta;
    }
    const wk = getCurrentWeekStr();
    if (store.weeks[wk]) {
      store.schedule = store.weeks[wk].schedule;
      store.edited = store.weeks[wk].edited;
    } else {
      regenSchedule();
    }
    log(`Semana: ${wk}`, 'info');
    saveState();
  render();
  }

  document.getElementById('datePicker')?.addEventListener('change', (e) => {
    if (e.target.value) navigateWeek(0, e.target.value);
  });

  document.getElementById('bPrev')?.addEventListener('click', () => {
    navigateWeek(-1);
  });

  document.getElementById('bNext')?.addEventListener('click', () => {
    navigateWeek(1);
  });

  document.getElementById('bReset')?.addEventListener('click', () => {
    store.SH = JSON.parse(JSON.stringify(DEFAULT_SHIFTS));
    store.EMPLOYEES = JSON.parse(JSON.stringify(DEFAULT_EMPLOYEES));
    store.customCounter = 0;
    regenSchedule();
    log('Estado completo restablecido', 'info');
    saveState();
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
      saveState();
  render();
    });
  });
}
