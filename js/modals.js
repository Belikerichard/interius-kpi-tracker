import { appData } from './state.js';
import { uid, showToast } from './utils.js';
import { canEdit } from './permissions.js';
import { persist } from './data.js';
import { renderClientesGrid } from './views/clientes.js';
import { renderEquipoGrid, openPersonaDetalle } from './views/equipo.js';
import { renderOrganigrama } from './views/organigrama.js';
import { renderKpiTable, refreshSelects } from './views/kpis.js';
import { renderDashboard } from './views/dashboard.js';

export function openModal(id) {
  document.getElementById(id).classList.add('show');
}
export function closeModal(id) {
  document.getElementById(id).classList.remove('show');
}

document.querySelectorAll('[data-close]').forEach((btn) => {
  btn.addEventListener('click', () => closeModal(btn.dataset.close));
});
document.querySelectorAll('.overlay').forEach((overlay) => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const open = document.querySelector('.overlay.show');
  if (open) closeModal(open.id);
});

/* ---- cliente ---- */
document.getElementById('btn-add-cliente').addEventListener('click', () => {
  document.getElementById('mc-name').value = '';
  document.getElementById('mc-industria').value = '';
  document.getElementById('mc-contacto').value = '';
  openModal('modal-cliente');
});
document.getElementById('mc-save').addEventListener('click', async () => {
  if (!canEdit()) return;
  const name = document.getElementById('mc-name').value.trim();
  if (!name) {
    showToast('Ponle un nombre al cliente');
    return;
  }
  appData.clientes.push({
    id: uid('cli'),
    name,
    industria: document.getElementById('mc-industria').value.trim(),
    contacto: document.getElementById('mc-contacto').value.trim(),
  });
  await persist();
  closeModal('modal-cliente');
  renderClientesGrid();
  showToast('Cliente agregado');
});

/* ---- persona ---- */
document.getElementById('btn-add-persona').addEventListener('click', () => openPersonaModal(null));
document.getElementById('btn-add-persona-org').addEventListener('click', () => openPersonaModal(null));

function fillReportsToSelect(excludeId) {
  const sel = document.getElementById('mp-reportsto');
  const opts = appData.personas
    .filter((p) => p.id !== excludeId)
    .map((p) => `<option value="${p.id}">${p.name}</option>`)
    .join('');
  sel.innerHTML = `<option value="">Nadie (nivel superior)</option>` + opts;
}

export function openPersonaModal(id) {
  fillReportsToSelect(id);
  document.getElementById('mp-title').textContent = id ? 'Editar persona' : 'Nueva persona del equipo';
  document.getElementById('mp-id').value = id || '';
  if (id) {
    const p = appData.personas.find((x) => x.id === id);
    document.getElementById('mp-name').value = p.name;
    document.getElementById('mp-rol').value = p.rol || '';
    document.getElementById('mp-reportsto').value = p.reportsTo || '';
  } else {
    document.getElementById('mp-name').value = '';
    document.getElementById('mp-rol').value = '';
    document.getElementById('mp-reportsto').value = '';
  }
  openModal('modal-persona');
}

document.getElementById('mp-save').addEventListener('click', async () => {
  if (!canEdit()) return;
  const name = document.getElementById('mp-name').value.trim();
  if (!name) {
    showToast('Ponle un nombre a la persona');
    return;
  }
  const id = document.getElementById('mp-id').value;
  const rol = document.getElementById('mp-rol').value.trim();
  let reportsTo = document.getElementById('mp-reportsto').value || null;
  if (id && reportsTo === id) reportsTo = null;
  if (id) {
    const p = appData.personas.find((x) => x.id === id);
    Object.assign(p, { name, rol, reportsTo });
  } else {
    appData.personas.push({ id: uid('per'), name, rol, reportsTo });
  }
  await persist();
  closeModal('modal-persona');
  renderEquipoGrid();
  renderOrganigrama();
  if (id && document.getElementById('view-persona-detalle').classList.contains('active')) openPersonaDetalle(id);
  showToast('Persona guardada');
});

/* ---- kpi ---- */
document.getElementById('btn-add-kpi').addEventListener('click', () => openKpiModal(null));

export function openKpiModal(id) {
  refreshSelects();
  document.getElementById('mk-title').textContent = id ? 'Editar KPI' : 'Nuevo KPI';
  document.getElementById('mk-id').value = id || '';
  if (id) {
    const k = appData.kpis.find((x) => x.id === id);
    document.getElementById('mk-name').value = k.name;
    document.getElementById('mk-categoria').value = k.categoria;
    document.getElementById('mk-unidad').value = k.unidad;
    document.getElementById('mk-meta').value = k.meta;
    document.getElementById('mk-actual').value = k.actual;
    document.getElementById('mk-direccion').value = k.direccion;
    document.getElementById('mk-cliente').value = k.clienteId || '';
    document.getElementById('mk-persona').value = k.personaId || '';
  } else {
    document.getElementById('mk-name').value = '';
    document.getElementById('mk-meta').value = '';
    document.getElementById('mk-actual').value = '';
    document.getElementById('mk-cliente').value = '';
    document.getElementById('mk-persona').value = '';
  }
  openModal('modal-kpi');
}

document.getElementById('mk-save').addEventListener('click', async () => {
  if (!canEdit()) return;
  const name = document.getElementById('mk-name').value.trim();
  const meta = Number(document.getElementById('mk-meta').value);
  if (!name || !meta) {
    showToast('Nombre y meta son obligatorios');
    return;
  }
  const id = document.getElementById('mk-id').value;
  const payload = {
    name,
    categoria: document.getElementById('mk-categoria').value,
    unidad: document.getElementById('mk-unidad').value,
    meta,
    actual: Number(document.getElementById('mk-actual').value) || 0,
    direccion: document.getElementById('mk-direccion').value,
    clienteId: document.getElementById('mk-cliente').value || null,
    personaId: document.getElementById('mk-persona').value || null,
  };
  if (id) {
    const k = appData.kpis.find((x) => x.id === id);
    Object.assign(k, payload);
  } else {
    appData.kpis.push({ id: uid('kpi'), ...payload });
  }
  await persist();
  closeModal('modal-kpi');
  renderKpiTable();
  renderDashboard();
  showToast('KPI guardado');
});
