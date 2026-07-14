import { colorFor, initials } from '../utils.js';
import { avgAchievement, ratingFromScore } from '../calc.js';
import { visiblePersonas, visibleKpisByPersona } from '../permissions.js';
import { switchView } from '../nav.js';
import { openPersonaDetalle } from './equipo.js';

export function renderOrganigrama() {
  const wrap = document.getElementById('org-chart-wrap');
  const personas = visiblePersonas();
  if (!personas.length) {
    wrap.innerHTML = `<div class="empty">Aún no hay integrantes en el equipo. Agrega el primero.</div>`;
    return;
  }
  const validIds = new Set(personas.map((p) => p.id));
  const roots = personas.filter((p) => !p.reportsTo || !validIds.has(p.reportsTo));
  wrap.innerHTML = `<ul class="tree">${roots.map((r) => orgNodeHtml(r.id, new Set())).join('')}</ul>`;
  wrap.querySelectorAll('[data-orgnode]').forEach((el) => {
    el.addEventListener('click', () => {
      openPersonaDetalle(el.dataset.orgnode);
      switchView('persona-detalle');
    });
  });
}

function orgNodeHtml(id, visited) {
  if (visited.has(id)) return '';
  const nextVisited = new Set(visited);
  nextVisited.add(id);
  const personas = visiblePersonas();
  const p = personas.find((x) => x.id === id);
  if (!p) return '';
  const kpis = visibleKpisByPersona(id);
  const avg = Math.round(avgAchievement(kpis));
  const rating = ratingFromScore(kpis.length ? avg : 100);
  const children = personas.filter((x) => x.reportsTo === id);
  return `<li>
    <div class="org-card" data-orgnode="${id}">
      <div class="avatar" style="background:${colorFor(id, personas)};margin:0 auto;">${initials(p.name)}</div>
      <div class="org-name">${p.name}</div>
      <div class="org-role">${p.rol || ''}</div>
      ${kpis.length ? `<span class="badge" style="background:${rating.color}22;color:${rating.color};margin-top:6px;">${avg}%</span>` : ''}
    </div>
    ${children.length ? `<ul>${children.map((c) => orgNodeHtml(c.id, nextVisited)).join('')}</ul>` : ''}
  </li>`;
}
