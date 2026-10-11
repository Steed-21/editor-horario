import { store, ensureRosterHistory, getActiveEmployees } from '../state/store.js';
import { buildWeek } from '../domain/schedule.js';
import { validate } from '../domain/validation.js';
import { log } from '../ui/components/log.js';
import { render } from '../ui/layout.js';
import { animateWeekNavigation } from '../ui/navigationMotion.js';
import { closeModal } from '../ui/modals/modal.js';
import { openShiftBaseEditor } from '../ui/modals/shiftEditor.js';
import { openWeekTeamEditor } from '../ui/modals/weekTeamEditor.js';
import { openEmployeesEditor } from '../ui/modals/empEditor.js';
import { DEFAULT_SHIFTS } from '../config/shifts.js';
import { DEFAULT_EMPLOYEES } from '../config/employees.js';
import { getMonday, addWeeks, weekOffset } from '../domain/dateUtils.js';
import { getCurrentWeekStr, saveState, loadSelectedWeek, canUseShiftCatalog, syncState, isLegacyWeek } from '../state/store.js';
import { syncReader } from '../state/readerSync.js';
import { clearSessionState, clearAdminCache } from '../state/store.js';
import { auth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from '../services/firebase.js';

import { openCellEditor, selectShiftForCell, toggleCellBreak, updateCellBreak, confirmCellEdit } from '../ui/modals/cellEditor.js';
import { createCustomShift, deleteShift, openSingleShiftEditor, previewShiftHours, saveShiftEdit } from '../ui/modals/shiftEditor.js';
import { openEmployeeAdd, confirmAddEmployee, openEmployeeEdit, saveEmployeeEdit, deleteEmployee, deactivateEmployee } from '../ui/modals/empEditor.js';

const initializedDocuments = new WeakSet();
export function setupEvents() {
  if (initializedDocuments.has(document)) return;
  initializedDocuments.add(document);
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
  window.deactivateEmployee = deactivateEmployee;

  document.getElementById('modalClose')?.addEventListener('click', closeModal);
  document.getElementById('modalBg')?.addEventListener('click', e => {
    if(e.target.id === 'modalBg') closeModal();
  });

  let synchronizedUid;
  let synchronizedAdmin;
  let stopSync = null;
  onAuthStateChanged(auth, (user) => {
    const nextUid = user?.uid ?? null;
    const adminEmail = import.meta.env.VITE_ADMIN_EMAIL;
    const nextAdmin = !!user && !!adminEmail
      && user.email === adminEmail && user.emailVerified === true;
    if (nextUid !== synchronizedUid || nextAdmin !== synchronizedAdmin) {
      if (stopSync) stopSync();
      stopSync = null;
      // Preserve admin reload caching, but never hydrate it in another role/session.
      if (!nextAdmin || synchronizedUid !== undefined) clearAdminCache();
      clearSessionState({ admin: nextAdmin });
      for (const id of ['modalTitle', 'modalBody']) {
        const node = document.getElementById(id);
        if (node) node.textContent = '';
      }
      synchronizedUid = nextUid;
      synchronizedAdmin = nextAdmin;
    }
    store.isAdmin = nextAdmin;

    // Auth gate: sin sesión, la app entera queda oculta detrás del login.
    const container = document.querySelector('.container');
    const loginBg = document.getElementById('loginBg');
    if (user) {
      if (loginBg) loginBg.style.display = 'none';
      if (container) container.style.display = '';
    } else {
      if (container) container.style.display = 'none';
      if (loginBg) loginBg.style.display = 'flex';
      // Limpiar campos al volver al login
      const em = document.getElementById('loginEmail');
      const pw = document.getElementById('loginPwd');
      const er = document.getElementById('loginError');
      if (em) em.value = '';
      if (pw) pw.value = '';
      if (er) { er.style.display = 'none'; er.textContent = ''; }
    }

    const bLogin = document.getElementById('bLogin');
    if (bLogin) {
      if (user) {
        bLogin.textContent = store.isAdmin ? 'Salir' : 'Salir (lectura)';
        bLogin.style.color = store.isAdmin ? '#1D9E75' : 'var(--text-secondary)';
      } else {
        bLogin.textContent = 'Admin';
        bLogin.style.color = 'var(--text-secondary)';
      }
    }
    if (user && !stopSync) {
      // Auth resolution owns cache hydration and each role's RTDB lifecycle.
      stopSync = store.isAdmin ? syncState(render) : syncReader(render);
    } else render();
  });

  // Único uso del botón superior: cerrar sesión. Sin sesión no se ve.
  document.getElementById('bLogin')?.addEventListener('click', () => {
    signOut(auth);
  });

  document.getElementById('loginPwdToggle')?.addEventListener('click', () => {
    const password = document.getElementById('loginPwd');
    const toggle = document.getElementById('loginPwdToggle');
    const visible = password.type === 'password';
    password.type = visible ? 'text' : 'password';
    toggle.setAttribute('aria-label', visible ? 'Ocultar contraseña' : 'Mostrar contraseña');
    toggle.setAttribute('aria-pressed', String(visible));
  });

  let loginPending = false;
  document.getElementById('loginForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    if (loginPending) return;
    const email = document.getElementById('loginEmail').value;
    const pwd = document.getElementById('loginPwd').value;
    const errBox = document.getElementById('loginError');
    if (errBox) { errBox.style.display = 'none'; errBox.textContent = ''; }
    if (!email.trim() || !pwd) {
      if (errBox) { errBox.textContent = 'Correo y contraseña son obligatorios.'; errBox.style.display = 'block'; }
      return;
    }

    const form = document.getElementById('loginForm');
    const btn = document.getElementById('bLoginSubmit');
    loginPending = true;
    form.setAttribute('aria-busy', 'true');
    btn.textContent = 'Iniciando...';
    btn.disabled = true;
    try {
      await signInWithEmailAndPassword(auth, email, pwd);
      // Successful authentication remains owned by onAuthStateChanged.
    } catch (_error) {
      if (errBox) {
        errBox.textContent = 'Credenciales inválidas o usuario no autorizado.';
        errBox.style.display = 'block';
      }
    } finally {
      loginPending = false;
      form.setAttribute('aria-busy', 'false');
      btn.textContent = 'Entrar';
      btn.disabled = false;
    }
  });

  // Bridge runtimes that omit implicit submission; retain native form validation.
  for (const id of ['loginEmail', 'loginPwd']) {
    document.getElementById(id)?.addEventListener('keydown', event => {
      if (event.key !== 'Enter' || event.isComposing) return;
      event.preventDefault();
      if (loginPending || event.repeat) return;
      document.getElementById('loginForm').requestSubmit(document.getElementById('bLoginSubmit'));
    });
  }

  function navigateWeek(delta, newDateStr = null) {
    store.selectedWeek = newDateStr ? getMonday(newDateStr) : addWeeks(getCurrentWeekStr(), delta);
    store.wo = weekOffset(store.baseDate, store.selectedWeek);
    if (store.isAdmin) loadSelectedWeek();
    else if (stopSync?.selectWeek) stopSync.selectWeek();
    else {
      store.schedule = []; store.edited = []; store.scheduleRoster = [];
      store.weekStatus = 'missing';
    }
    render();
    if (!newDateStr) animateWeekNavigation(delta);
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

  document.getElementById('bCreateWeek')?.addEventListener('click', () => {
    if (!store.isAdmin || store.weekStatus !== 'missing' || store.pendingWrite != null) return;
    try {
      // Creation is explicit and uses the active catalogs, independently of reset.
      ensureRosterHistory();
      const roster = getActiveEmployees();
      const schedule = buildWeek(store.wo, roster);
      store.scheduleRoster = structuredClone(roster);
      store.schedule = schedule;
      store.edited = schedule.map(row => row.map(() => false));
      store.weekStatus = 'proposal';
      saveState();
    } catch (error) {
      log(error.message, 'err');
    }
    render();
  });

  document.getElementById('bReset')?.addEventListener('click', () => {
    if (!store.isAdmin) return;
    if (isLegacyWeek() || store.weekStatus === 'legacy') { log('Restablecer bloqueado: histórico inconsistente de solo lectura', 'err'); return; }
    const hasHistory = Object.keys(store.weeks).some(key => key !== getCurrentWeekStr());
    const sameEmployees = store.EMPLOYEES.length === DEFAULT_EMPLOYEES.length
      && DEFAULT_EMPLOYEES.every((e, pi) => store.EMPLOYEES[pi]?.name === e.name
        && store.EMPLOYEES[pi]?.freeDay === e.freeDay);
    const sameShifts = Object.keys(store.SH).length === Object.keys(DEFAULT_SHIFTS).length
      && Object.entries(DEFAULT_SHIFTS).every(([id, shift]) => Object.entries(shift).every(([field, value]) =>
        (store.SH[id]?.[field] ?? null) === (value ?? null)) && (store.SH[id]?.defaultBd || 1) === 1);
    // Check all references before replacing any catalog or generating a week.
    if ((hasHistory && (!sameEmployees || !sameShifts)) || !canUseShiftCatalog(DEFAULT_SHIFTS)
        || Object.entries(store.weeks).some(([key, week]) => key !== getCurrentWeekStr()
          && week.schedule?.length !== DEFAULT_EMPLOYEES.length)) {
      log('Restablecer bloqueado: afectaría a semanas guardadas', 'err');
      return;
    }
    let schedule;
    try {
      schedule = buildWeek(store.wo, DEFAULT_EMPLOYEES, DEFAULT_SHIFTS);
    } catch (error) {
      log(error.message, 'err');
      return;
    }
    store.SH = JSON.parse(JSON.stringify(DEFAULT_SHIFTS));
    if (!hasHistory) store.EMPLOYEES = JSON.parse(JSON.stringify(DEFAULT_EMPLOYEES));
    store.customCounter = 0;
    ensureRosterHistory();
    store.scheduleRoster = structuredClone(store.EMPLOYEES);
    store.schedule = schedule;
    store.edited = schedule.map(row => row.map(() => false));
    store.currentEdit = null;
    store.activeEditor = null;
    store.editorInvalidated = true;
    store.weekStatus = 'proposal';
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
  document.getElementById('bEditWeek')?.addEventListener('click', openWeekTeamEditor);

  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      store.view = t.dataset.view;
      render();
    });
  });
}
