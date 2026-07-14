import { appData } from './state.js';
import { currentUser } from './auth.js';
import { kpisByCliente, kpisByPersona } from './calc.js';

export function canEdit() {
  return currentUser?.role === 'super_admin';
}

export function canViewPeopleAnalytics() {
  return currentUser?.role === 'super_admin';
}

export function visiblePersonas() {
  if (currentUser?.role === 'usuario') {
    return appData.personas.filter((p) => p.id === currentUser.personaId);
  }
  return appData.personas;
}

export function visibleKpis() {
  if (currentUser?.role === 'usuario') {
    return appData.kpis.filter((k) => k.personaId === currentUser.personaId);
  }
  return appData.kpis;
}

export function visibleClientes() {
  if (currentUser?.role === 'usuario') {
    const ids = new Set(visibleKpis().map((k) => k.clienteId));
    return appData.clientes.filter((c) => ids.has(c.id));
  }
  return appData.clientes;
}

export function visibleKpisByCliente(id) {
  const list = kpisByCliente(id);
  return currentUser?.role === 'usuario' ? list.filter((k) => k.personaId === currentUser.personaId) : list;
}

export function visibleKpisByPersona(id) {
  const list = kpisByPersona(id);
  return currentUser?.role === 'usuario' ? list.filter((k) => k.personaId === currentUser.personaId) : list;
}

/* Oculta la navegación/acciones a las que el rol actual no tiene derecho.
   Esto es control de UI, no seguridad: ver el aviso en auth.js. */
export function applyPermissionsToChrome() {
  ['btn-add-cliente', 'btn-add-persona', 'btn-add-persona-org', 'btn-add-kpi', 'btn-restore-source'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = canEdit() ? '' : 'none';
  });
  const peopleNav = document.querySelector('.navbtn[data-view="people"]');
  if (peopleNav) peopleNav.style.display = canViewPeopleAnalytics() ? '' : 'none';
}
