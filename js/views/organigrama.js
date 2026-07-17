import { appData } from '../state.js';
import { initials, PALETTE } from '../utils.js';
import { visiblePersonas } from '../permissions.js';
import { switchView } from '../nav.js';
import { openPersonaDetalle } from './equipo.js';

const expandedIds = new Set();
let searchQuery = '';

const SIZE_BY_DEPTH = [
  { avatar: 56, width: 172, font: 17 },
  { avatar: 46, width: 154, font: 15 },
  { avatar: 40, width: 142, font: 13 },
];
function sizeForDepth(depth) {
  return SIZE_BY_DEPTH[Math.min(depth, SIZE_BY_DEPTH.length - 1)];
}

function normalize(s) {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

export function renderOrganigrama() {
  const wrap = document.getElementById('org-chart-wrap');
  const personas = visiblePersonas();
  if (!personas.length) {
    wrap.innerHTML = `<div class="empty">Aún no hay integrantes en el equipo. Agrega el primero.</div>`;
    return;
  }
  const validIds = new Set(personas.map((p) => p.id));
  const personaById = Object.fromEntries(personas.map((p) => [p.id, p]));
  const childrenMap = {};
  personas.forEach((p) => {
    if (p.reportsTo && validIds.has(p.reportsTo)) (childrenMap[p.reportsTo] ||= []).push(p);
  });
  const empleadoById = Object.fromEntries(appData.empleados.map((e) => [e.id, e]));
  const roots = personas.filter((p) => !p.reportsTo || !validIds.has(p.reportsTo));

  const q = normalize(searchQuery);
  let matches = new Set();
  if (q) {
    personas.forEach((p) => {
      if (normalize(p.name).includes(q)) {
        matches.add(p.id);
        // revela la ruta hasta la raíz para que el match quede visible
        let cur = p;
        while (cur.reportsTo && personaById[cur.reportsTo]) {
          expandedIds.add(cur.reportsTo);
          cur = personaById[cur.reportsTo];
        }
      }
    });
  }

  wrap.innerHTML = q && !matches.size
    ? `<div class="empty">Nadie con "${searchQuery}" en el nombre.</div>`
    : `<div class="org-tree">${renderLevel(roots, null, childrenMap, empleadoById, new Set(), 0, matches)}</div>`;

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

document.getElementById('org-search').addEventListener('input', (e) => {
  searchQuery = e.target.value;
  renderOrganigrama();
});
document.getElementById('org-collapse-all').addEventListener('click', () => {
  expandedIds.clear();
  searchQuery = '';
  document.getElementById('org-search').value = '';
  renderOrganigrama();
});

function renderLevel(nodes, color, childrenMap, empleadoById, visited, depth, matches) {
  return `<div class="org-level">${nodes.map((n, i) => renderNode(n, color ?? PALETTE[i % PALETTE.length], childrenMap, empleadoById, visited, depth, matches)).join('')}</div>`;
}

function renderNode(p, color, childrenMap, empleadoById, visited, depth, matches) {
  if (visited.has(p.id)) return '';
  const nextVisited = new Set(visited);
  nextVisited.add(p.id);

  const kids = childrenMap[p.id] || [];
  const size = teamSize(p.id, childrenMap, new Set());
  const expanded = expandedIds.has(p.id);
  const area = empleadoById[p.id]?.area || '';
  const { avatar, width, font } = sizeForDepth(depth);
  const isMatch = matches.has(p.id);

  return `<div class="org-node">
    <div class="org-card2${isMatch ? ' org-match' : ''}" style="--org-color:${color};width:${width}px;min-height:${width + 20}px" data-orgcard="${p.id}">
      <div class="avatar" style="width:${avatar}px;height:${avatar}px;border-radius:50%;font-size:${font}px;margin:0 auto 10px;background:${color}">${initials(p.name)}</div>
      <div class="org-dept-label" style="color:${color}">${area || ' '}</div>
      <div class="org-name">${p.name}</div>
      <div class="org-role">${p.rol || 'Sin puesto'}</div>
      ${size ? `<div class="badge-team" style="background:${color}1a;color:${color}">${size} ${size === 1 ? 'persona' : 'personas'}</div>` : ''}
    </div>
    ${kids.length ? `<button type="button" class="org-toggle" data-orgtoggle="${p.id}">${expanded ? '▲ Ocultar equipo' : `▾ Ver equipo (${kids.length})`}</button>` : ''}
    ${
      kids.length && expanded
        ? `<div class="org-connector" style="background:${color}"></div>${renderLevel(kids, color, childrenMap, empleadoById, nextVisited, depth + 1, matches)}`
        : ''
    }
  </div>`;
}

function teamSize(id, childrenMap, visited) {
  if (visited.has(id)) return 0;
  visited.add(id);
  const kids = childrenMap[id] || [];
  return kids.reduce((sum, k) => sum + 1 + teamSize(k.id, childrenMap, visited), 0);
}
