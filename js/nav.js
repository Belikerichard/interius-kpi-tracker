import { renderDashboard } from './views/dashboard.js';
import { renderClientesGrid } from './views/clientes.js';
import { renderEquipoGrid } from './views/equipo.js';
import { renderKpiTable } from './views/kpis.js';
import { renderOrganigrama } from './views/organigrama.js';
import { renderPeopleView } from './views/people.js';

const VIEW_IDS = {
  dashboard: 'view-dashboard',
  clientes: 'view-clientes',
  equipo: 'view-equipo',
  kpis: 'view-kpis',
  'cliente-detalle': 'view-cliente-detalle',
  'persona-detalle': 'view-persona-detalle',
  organigrama: 'view-organigrama',
  people: 'view-people',
};

export function switchView(name) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.querySelectorAll('.navbtn').forEach((b) => b.classList.remove('active'));
  document.getElementById(VIEW_IDS[name]).classList.add('active');
  const navBtn = document.querySelector(`.navbtn[data-view="${name}"]`);
  if (navBtn) navBtn.classList.add('active');
  if (name === 'dashboard') renderDashboard();
  if (name === 'clientes') renderClientesGrid();
  if (name === 'equipo') renderEquipoGrid();
  if (name === 'kpis') renderKpiTable();
  if (name === 'organigrama') renderOrganigrama();
  if (name === 'people') renderPeopleView();
}

document.querySelectorAll('.navbtn').forEach((btn) => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});
document.querySelectorAll('[data-back]').forEach((el) => {
  el.addEventListener('click', () => switchView(el.dataset.back));
});
