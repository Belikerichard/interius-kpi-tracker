import { appData } from '../state.js';
import { achievement, statusOf, statusLabel, clienteName, personaName } from '../calc.js';
import { persist } from '../data.js';
import { showToast } from '../utils.js';
import { openKpiModal } from '../modals.js';

export function refreshSelects() {
  const fc = document.getElementById('filter-cliente');
  const fp = document.getElementById('filter-persona');
  const mkc = document.getElementById('mk-cliente');
  const mkp = document.getElementById('mk-persona');
  const clienteOpts = appData.clientes.map((c) => `<option value="${c.id}">${c.name}</option>`).join('');
  const personaOpts = appData.personas.map((p) => `<option value="${p.id}">${p.name}</option>`).join('');
  fc.innerHTML = `<option value="">Todos los clientes</option>` + clienteOpts;
  fp.innerHTML = `<option value="">Todo el equipo</option>` + personaOpts;
  mkc.innerHTML = `<option value="">Sin cliente</option>` + clienteOpts;
  mkp.innerHTML = `<option value="">Sin asignar</option>` + personaOpts;
}

export function renderKpiTable() {
  refreshSelects();
  const fc = document.getElementById('filter-cliente').value;
  const fp = document.getElementById('filter-persona').value;
  const fe = document.getElementById('filter-estado').value;
  let rows = appData.kpis.filter((k) => {
    if (fc && k.clienteId !== fc) return false;
    if (fp && k.personaId !== fp) return false;
    if (fe && statusOf(achievement(k)) !== fe) return false;
    return true;
  });
  const tbody = document.querySelector('#kpi-table tbody');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty">No hay KPIs con esos filtros.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows
    .map((k) => {
      const pct = achievement(k);
      const st = statusOf(pct);
      return `<tr>
      <td><strong>${k.name}</strong><div class="meta" style="color:#9A9AAE">${k.categoria}</div></td>
      <td>${clienteName(k.clienteId)}</td>
      <td>${personaName(k.personaId)}</td>
      <td>${k.meta}${k.unidad}</td>
      <td><input type="number" step="any" value="${k.actual}" data-update="${k.id}" style="width:75px"></td>
      <td>${Math.round(pct)}%</td>
      <td><span class="badge ${st}">${statusLabel(st)}</span></td>
      <td><button class="btn small secondary" data-editkpi="${k.id}">Editar</button></td>
    </tr>`;
    })
    .join('');

  tbody.querySelectorAll('[data-update]').forEach((inp) => {
    inp.addEventListener('change', async () => {
      const kpi = appData.kpis.find((k) => k.id === inp.dataset.update);
      kpi.actual = Number(inp.value);
      await persist();
      renderKpiTable();
      showToast('KPI actualizado');
    });
  });
  tbody.querySelectorAll('[data-editkpi]').forEach((btn) => {
    btn.addEventListener('click', () => openKpiModal(btn.dataset.editkpi));
  });
}

['filter-cliente', 'filter-persona', 'filter-estado'].forEach((id) => {
  document.getElementById(id).addEventListener('change', renderKpiTable);
});
