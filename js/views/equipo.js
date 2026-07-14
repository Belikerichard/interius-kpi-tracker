import { appData } from '../state.js';
import { colorFor, initials } from '../utils.js';
import { achievement, avgAchievement, ratingFromScore, statusOf, clienteName, personaName } from '../calc.js';
import { visiblePersonas, visibleKpisByPersona, canEdit } from '../permissions.js';
import { openPersonaModal } from '../modals.js';

export function renderEquipoGrid() {
  const grid = document.getElementById('equipo-grid');
  const personas = visiblePersonas();
  if (!personas.length) {
    grid.innerHTML = `<div class="empty">Aún no hay integrantes. Agrega el primero.</div>`;
    return;
  }
  grid.innerHTML = personas
    .map((p) => {
      const kpis = visibleKpisByPersona(p.id);
      const avg = Math.round(avgAchievement(kpis));
      const rating = ratingFromScore(kpis.length ? avg : 100);
      return `<div class="entity-card clickable" data-persona="${p.id}">
      <div class="top-row">
        <div class="avatar" style="background:${colorFor(p.id, personas)}">${initials(p.name)}</div>
        <span class="badge" style="background:${rating.color}22;color:${rating.color}">${kpis.length ? rating.label : 'Sin KPIs'}</span>
      </div>
      <div class="name">${p.name}</div>
      <div class="sub">${p.rol || 'Sin puesto'}</div>
      <div class="stats-row">
        <div><strong>${kpis.length}</strong>KPIs</div>
        <div><strong>${kpis.length ? avg + '%' : '—'}</strong>Desempeño</div>
      </div>
      <div class="progress-bar"><div style="width:${Math.min(avg, 100)}%;background:${rating.color}"></div></div>
    </div>`;
    })
    .join('');
  grid.querySelectorAll('[data-persona]').forEach((el) => {
    el.addEventListener('click', () => openPersonaDetalle(el.dataset.persona));
  });
}

export function openPersonaDetalle(id) {
  const p = appData.personas.find((x) => x.id === id);
  const kpis = visibleKpisByPersona(id);
  const avg = Math.round(avgAchievement(kpis));
  const rating = ratingFromScore(kpis.length ? avg : 100);
  const clientesInv = [...new Set(kpis.map((k) => k.clienteId))].map((cid) => appData.clientes.find((c) => c.id === cid)).filter(Boolean);
  const managerName = p.reportsTo ? personaName(p.reportsTo) : null;
  const directReports = appData.personas.filter((x) => x.reportsTo === id);

  document.getElementById('persona-detalle-content').innerHTML = `
    <div class="topbar">
      <div>
        <h1>${p.name}</h1>
        <p>${p.rol || 'Sin puesto asignado'}${managerName ? ' · Reporta a ' + managerName : ' · Nivel superior'}</p>
      </div>
      ${canEdit() ? `<button class="btn secondary" id="btn-edit-persona">Editar</button>` : ''}
    </div>
    <div class="cards-row">
      <div class="stat-card"><div class="label">Cumplimiento promedio</div><div class="value">${kpis.length ? avg + '%' : '—'}</div></div>
      <div class="stat-card"><div class="label">KPIs bajo su responsabilidad</div><div class="value">${kpis.length}</div></div>
      <div class="stat-card"><div class="label">Personas a su cargo</div><div class="value">${directReports.length}</div></div>
      <div class="stat-card">
        <div class="label">Calificación de desempeño estimada</div>
        <div class="value" style="font-size:18px;margin-top:10px;color:${rating.color}">${kpis.length ? rating.label : 'Sin datos'}</div>
      </div>
    </div>
    <div class="panel">
      <h3><span class="bracket-mini">[</span> Cómo impacta esto su calificación <span class="bracket-mini">]</span></h3>
      <p style="font-size:13px;color:#5B5B70;line-height:1.6;margin:0 0 10px;">
        La calificación se calcula como el promedio de cumplimiento de todos los KPIs de negocio bajo su responsabilidad
        (capado a 130% por KPI para evitar que un solo resultado sobresaliente distorsione el resto).
        <strong>≥95% Excelente · 80–94% Bueno · 60–79% Regular · &lt;60% Necesita atención.</strong>
      </p>
      <div class="progress-bar" style="height:10px;"><div style="width:${Math.min(avg, 100)}%;background:${rating.color}"></div></div>
    </div>
    <div class="grid-2">
      <div class="panel">
        <h3><span class="bracket-mini">[</span> KPIs asignados <span class="bracket-mini">]</span></h3>
        ${
          kpis.length
            ? kpis
                .map((k) => {
                  const pct = achievement(k);
                  const s = statusOf(pct);
                  return `<div class="kpi-list-item">
            <div><div class="name">${k.name}</div><div class="meta">Cliente: ${clienteName(k.clienteId)}</div></div>
            <div style="display:flex;align-items:center;gap:10px;">
              <span class="meta">${k.actual}${k.unidad} / ${k.meta}${k.unidad}</span>
              <span class="badge ${s}">${Math.round(pct)}%</span>
            </div>
          </div>`;
                })
                .join('')
            : `<div class="empty">Sin KPIs asignados todavía.</div>`
        }
      </div>
      <div class="panel">
        <h3><span class="bracket-mini">[</span> Clientes en los que participa <span class="bracket-mini">]</span></h3>
        ${clientesInv.length ? clientesInv.map((c) => `<div class="kpi-list-item"><div class="name">${c.name}</div><div class="meta">${c.industria || ''}</div></div>`).join('') : `<div class="empty">Sin clientes asignados.</div>`}
      </div>
    </div>
    <div class="panel">
      <h3><span class="bracket-mini">[</span> Relación de reporte <span class="bracket-mini">]</span></h3>
      <div class="kpi-list-item">
        <div><div class="name">Reporta a</div><div class="meta">Nivel jerárquico superior</div></div>
        <span class="badge" style="background:#EDEDF7;color:var(--azul)">${managerName || 'Nivel superior (sin jefe directo)'}</span>
      </div>
      <div class="kpi-list-item">
        <div><div class="name">Personas a su cargo</div><div class="meta">Reportan directamente a ${p.name}</div></div>
        <span class="badge" style="background:#EDEDF7;color:var(--azul)">${directReports.length ? directReports.map((d) => d.name).join(', ') : 'Ninguna'}</span>
      </div>
    </div>
  `;
  const editBtn = document.getElementById('btn-edit-persona');
  if (editBtn) editBtn.addEventListener('click', () => openPersonaModal(id));
}
