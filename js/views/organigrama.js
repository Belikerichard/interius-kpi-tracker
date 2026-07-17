import { appData } from '../state.js';
import { initials, PALETTE } from '../utils.js';
import { visiblePersonas } from '../permissions.js';
import { switchView } from '../nav.js';
import { openPersonaDetalle } from './equipo.js';

const expandedIds = new Set();

export function renderOrganigrama() {
  const wrap = document.getElementById('org-chart-wrap');
  const personas = visiblePersonas();
  if (!personas.length) {
    wrap.innerHTML = `<div class="empty">Aún no hay integrantes en el equipo. Agrega el primero.</div>`;
    return;
  }
  const validIds = new Set(personas.map((p) => p.id));
  const childrenMap = {};
  personas.forEach((p) => {
    if (p.reportsTo && validIds.has(p.reportsTo)) (childrenMap[p.reportsTo] ||= []).push(p);
  });
  const empleadoById = Object.fromEntries(appData.empleados.map((e) => [e.id, e]));
  const roots = personas.filter((p) => !p.reportsTo || !validIds.has(p.reportsTo));

  wrap.innerHTML = `<div class="org-tree">${renderLevel(roots, null, childrenMap, empleadoById, new Set())}</div>`;

  wrap.querySelectorAll('[data-orgcard]').forEach((el) => {
    el.addEventListener('click', () => {
      openPersonaDetalle(el.dataset.orgcard);
      switchView('persona-detalle');
    });
  });
  wrap.querySelectorAll('[data-orgtoggle]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.orgtoggle;
      if (expandedIds.has(id)) expandedIds.delete(id);
      else expandedIds.add(id);
      renderOrganigrama();
    });
  });
}

function renderLevel(nodes, color, childrenMap, empleadoById, visited) {
  return `<div class="org-level">${nodes.map((n, i) => renderNode(n, color ?? PALETTE[i % PALETTE.length], childrenMap, empleadoById, visited)).join('')}</div>`;
}

function renderNode(p, color, childrenMap, empleadoById, visited) {
  if (visited.has(p.id)) return '';
  const nextVisited = new Set(visited);
  nextVisited.add(p.id);

  const kids = childrenMap[p.id] || [];
  const size = teamSize(p.id, childrenMap, new Set());
  const expanded = expandedIds.has(p.id);
  const area = empleadoById[p.id]?.area || '';

  return `<div class="org-node">
    <div class="org-card2" style="--org-color:${color}" data-orgcard="${p.id}">
      <div class="avatar" style="width:56px;height:56px;border-radius:50%;font-size:17px;margin:0 auto 10px;background:${color}">${initials(p.name)}</div>
      ${area ? `<div class="org-dept-label" style="color:${color}">${area}</div>` : ''}
      <div class="org-name">${p.name}</div>
      <div class="org-role">${p.rol || 'Sin puesto'}</div>
      ${size ? `<div class="badge-team" style="background:${color}1a;color:${color}">${size} ${size === 1 ? 'persona' : 'personas'}</div>` : ''}
    </div>
    ${kids.length ? `<button type="button" class="org-toggle" data-orgtoggle="${p.id}">${expanded ? '▲ Ocultar equipo' : `▾ Ver equipo (${kids.length})`}</button>` : ''}
    ${kids.length && expanded ? `<div class="org-connector"></div>${renderLevel(kids, color, childrenMap, empleadoById, nextVisited)}` : ''}
  </div>`;
}

function teamSize(id, childrenMap, visited) {
  if (visited.has(id)) return 0;
  visited.add(id);
  const kids = childrenMap[id] || [];
  return kids.reduce((sum, k) => sum + 1 + teamSize(k.id, childrenMap, visited), 0);
}
