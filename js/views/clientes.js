import { appData } from '../state.js';
import { colorFor, initials } from '../utils.js';
import { achievement, kpisByCliente, kpisByPersona, avgAchievement, statusOf, statusLabel, personaName } from '../calc.js';
import { switchView } from '../nav.js';
import { openPersonaDetalle } from './equipo.js';

export function renderClientesGrid() {
  const grid = document.getElementById('clientes-grid');
  if (!appData.clientes.length) {
    grid.innerHTML = `<div class="empty">Aún no hay clientes. Agrega el primero.</div>`;
    return;
  }
  grid.innerHTML = appData.clientes
    .map((c) => {
      const kpis = kpisByCliente(c.id);
      const avg = Math.round(avgAchievement(kpis));
      const st = statusOf(avg);
      return `<div class="entity-card clickable" data-cliente="${c.id}">
      <div class="top-row">
        <div class="avatar" style="background:${colorFor(c.id, appData.clientes)}">${initials(c.name)}</div>
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
  const kpis = kpisByCliente(id);
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
      <div class="stat-card"><div class="label">Cumplimiento promedio</div><div class="value">${kpis.length ? avg + '%' : '—'}</div></div>
      <div class="stat-card"><div class="label">KPIs asignados</div><div class="value">${kpis.length}</div></div>
      <div class="stat-card"><div class="label">Estado general</div><div class="value" style="font-size:16px;margin-top:12px"><span class="badge ${st}">${statusLabel(st)}</span></div></div>
    </div>
    <div class="grid-2">
      <div class="panel">
        <h3><span class="bracket-mini">[</span> KPIs de negocio <span class="bracket-mini">]</span></h3>
        ${
          kpis.length
            ? kpis
                .map((k) => {
                  const pct = achievement(k);
                  const s = statusOf(pct);
                  return `<div class="kpi-list-item">
            <div><div class="name">${k.name}</div><div class="meta">${k.categoria} · Responsable: ${personaName(k.personaId)}</div></div>
            <div style="display:flex;align-items:center;gap:10px;">
              <span class="meta">${k.actual}${k.unidad} / ${k.meta}${k.unidad}</span>
              <span class="badge ${s}">${Math.round(pct)}%</span>
            </div>
          </div>`;
                })
                .join('')
            : `<div class="empty">Este cliente aún no tiene KPIs asignados.</div>`
        }
      </div>
      <div class="panel">
        <h3><span class="bracket-mini">[</span> Equipo involucrado <span class="bracket-mini">]</span></h3>
        ${
          involucrados.length
            ? involucrados
                .map((p) => {
                  const pkpis = kpisByPersona(p.id).filter((k) => k.clienteId === id);
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
