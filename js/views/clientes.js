import { appData } from '../state.js';
import { colorFor, initials, kpiRowHtml, statCardHtml } from '../utils.js';
import { avgAchievement, statusOf, statusLabel, personaName } from '../calc.js';
import { visibleClientes, visibleKpisByCliente, visibleKpisByPersona } from '../permissions.js';
import { switchView } from '../nav.js';
import { openPersonaDetalle } from './equipo.js';

export function renderClientesGrid() {
  const grid = document.getElementById('clientes-grid');
  const clientes = visibleClientes();
  if (!clientes.length) {
    grid.innerHTML = `<div class="empty">Aún no hay clientes. Agrega el primero.</div>`;
    return;
  }
  grid.innerHTML = clientes
    .map((c) => {
      const kpis = visibleKpisByCliente(c.id);
      const avg = Math.round(avgAchievement(kpis));
      const st = statusOf(avg);
      return `<div class="entity-card clickable" data-cliente="${c.id}">
      <div class="top-row">
        <div class="avatar" style="background:${colorFor(c.id, clientes)}">${initials(c.name)}</div>
        <span class="badge ${st}">${statusLabel(st)}</span>
      </div>
      <div class="name">${c.name}</div>
      <div class="sub">${c.industria || 'Sin industria'} · ${c.contacto || 'Sin contacto'}</div>
      <div class="stats-row">
        <div><strong>${kpis.length}</strong>KPIs</div>
        <div><strong>${kpis.length ? avg + '%' : '—'}</strong>Cumplimiento</div>
      </div>
      <div class="progress-bar"><div style="width:${Math.min(avg, 100)}%;background:${st === 'ok' ? 'var(--verde)' : st === 'warn' ? 'var(--amarillo)' : 'var(--rojo)'}"></div></div>
    </div>`;
    })
    .join('');
  grid.querySelectorAll('[data-cliente]').forEach((el) => {
    el.addEventListener('click', () => openClienteDetalle(el.dataset.cliente));
  });
}

export function openClienteDetalle(id) {
  const c = appData.clientes.find((x) => x.id === id);
  const kpis = visibleKpisByCliente(id);
  const avg = Math.round(avgAchievement(kpis));
  const st = statusOf(avg);
  const involucrados = [...new Set(kpis.map((k) => k.personaId))].map((pid) => appData.personas.find((p) => p.id === pid)).filter(Boolean);

  document.getElementById('cliente-detalle-content').innerHTML = `
    <div class="topbar">
      <div>
        <h1>${c.name}</h1>
        <p>${c.industria || 'Sin industria'} · Contacto: ${c.contacto || 'N/A'}</p>
      </div>
    </div>
    <div class="cards-row" style="grid-template-columns:repeat(3,1fr);">
      ${statCardHtml('Cumplimiento promedio', kpis.length ? avg + '%' : '—')}
      ${statCardHtml('KPIs asignados', kpis.length)}
      ${statCardHtml('Estado general', `<span class="badge ${st}">${statusLabel(st)}</span>`, 'font-size:16px;margin-top:12px')}
    </div>
    <div class="grid-2">
      <div class="panel">
        <h3><span class="bracket-mini">[</span> KPIs de negocio <span class="bracket-mini">]</span></h3>
        ${
          kpis.length
            ? kpis.map((k) => kpiRowHtml(k, `${k.categoria} · Responsable: ${personaName(k.personaId)}`)).join('')
            : `<div class="empty">Este cliente aún no tiene KPIs asignados.</div>`
        }
      </div>
      <div class="panel">
        <h3><span class="bracket-mini">[</span> Equipo involucrado <span class="bracket-mini">]</span></h3>
        ${
          involucrados.length
            ? involucrados
                .map((p) => {
                  const pkpis = visibleKpisByPersona(p.id).filter((k) => k.clienteId === id);
                  const pavg = Math.round(avgAchievement(pkpis));
                  return `<div class="kpi-list-item clickable" data-persona="${p.id}">
            <div style="display:flex;align-items:center;gap:10px;">
              <div class="avatar" style="width:30px;height:30px;font-size:11px;background:${colorFor(p.id, appData.personas)}">${initials(p.name)}</div>
              <div><div class="name">${p.name}</div><div class="meta">${p.rol}</div></div>
            </div>
            <span class="badge ${statusOf(pavg)}">${pavg}%</span>
          </div>`;
                })
                .join('')
            : `<div class="empty">Sin equipo asignado todavía.</div>`
        }
      </div>
    </div>
  `;
  document.querySelectorAll('#cliente-detalle-content [data-persona]').forEach((el) => {
    el.addEventListener('click', () => {
      switchView('persona-detalle');
      openPersonaDetalle(el.dataset.persona);
    });
  });
  switchView('cliente-detalle');
}
