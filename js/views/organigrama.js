import { appData } from '../state.js';
import { initials, PALETTE, withViewTransition } from '../utils.js';
import { visiblePersonas } from '../permissions.js';
import { switchView } from '../nav.js';
import { openPersonaDetalle } from './equipo.js';

let focusId = null; // null = sin selección: entra al CEO si hay uno solo, si no hay un único root muestra todos
let searchQuery = '';

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
  const colorOf = buildColorMap(roots, childrenMap);

  if (focusId && !personaById[focusId]) focusId = null; // por si la persona enfocada ya no existe
  if (focusId === null && roots.length === 1) focusId = roots[0].id; // entra directo al CEO y su equipo

  const q = normalize(searchQuery);
  let matchId = null;
  if (q) {
    const match = personas.find((p) => normalize(p.name).includes(q));
    if (match) {
      matchId = match.id;
      focusId = personaById[match.reportsTo] ? match.reportsTo : null;
    }
  }

  wrap.innerHTML =
    q && !matchId
      ? `<div class="empty">Nadie con "${searchQuery}" en el nombre.</div>`
      : renderFocusView(focusId, roots, childrenMap, personaById, empleadoById, colorOf, matchId);

  wrap.querySelectorAll('[data-orgcard]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.dataset.orgcard;
      if (el.dataset.hasreports === 'true') {
        focusId = id;
        searchQuery = '';
        document.getElementById('org-search').value = '';
        withViewTransition(() => renderOrganigrama());
      } else {
        openPersonaDetalle(id);
        switchView('persona-detalle');
      }
    });
  });
  wrap.querySelectorAll('[data-orgup]').forEach((btn) => {
    btn.addEventListener('click', () => {
      focusId = btn.dataset.orgup || null;
      withViewTransition(() => renderOrganigrama());
    });
  });
}

document.getElementById('org-search').addEventListener('input', (e) => {
  searchQuery = e.target.value;
  renderOrganigrama();
});
document.getElementById('org-collapse-all').addEventListener('click', () => {
  focusId = null;
  searchQuery = '';
  document.getElementById('org-search').value = '';
  withViewTransition(() => renderOrganigrama());
});

/* Cada raíz (manager de primer nivel) tiene su propio color; toda su
   descendencia hereda ese color para mantener identidad de rama al navegar. */
function buildColorMap(roots, childrenMap) {
  const map = {};
  roots.forEach((r, i) => {
    const color = PALETTE[i % PALETTE.length];
    const stack = [r.id];
    while (stack.length) {
      const id = stack.pop();
      map[id] = color;
      (childrenMap[id] || []).forEach((c) => stack.push(c.id));
    }
  });
  return map;
}

function renderFocusView(focusId, roots, childrenMap, personaById, empleadoById, colorOf, matchId) {
  const focus = focusId ? personaById[focusId] : null;
  const level = focus ? childrenMap[focus.id] || [] : roots;

  const upBtn = focus && personaById[focus.reportsTo] ? `<button type="button" class="org-up" data-orgup="${focus.reportsTo}">↑ Subir de nivel</button>` : '';

  const focusHtml = focus
    ? `<div class="org-focus">${renderCard(focus, colorOf[focus.id], childrenMap, empleadoById, 'lg', matchId === focus.id)}</div>
       <div class="org-connector" style="background:${colorOf[focus.id]}"></div>`
    : '';

  const levelHtml = level.length
    ? `<div class="org-level">${level.map((p) => renderCard(p, colorOf[p.id], childrenMap, empleadoById, 'md', matchId === p.id)).join('')}</div>`
    : `<div class="empty">Sin reportes directos.</div>`;

  return `<div class="org-focus-view">${upBtn}${focusHtml}${levelHtml}</div>`;
}

function renderCard(p, color, childrenMap, empleadoById, size, isMatch) {
  const kids = childrenMap[p.id] || [];
  const count = teamSize(p.id, childrenMap, new Set());
  const area = empleadoById[p.id]?.area || '';
  const dims = size === 'lg' ? { avatar: 68, width: 200, font: 20, minHeight: 236 } : { avatar: 52, width: 168, font: 16, minHeight: 200 };

  return `<div class="org-node">
    <div class="org-card2${isMatch ? ' org-match' : ''}" style="--org-color:${color};width:${dims.width}px;min-height:${dims.minHeight}px" data-orgcard="${p.id}" data-hasreports="${kids.length > 0}">
      <div class="avatar" style="width:${dims.avatar}px;height:${dims.avatar}px;border-radius:50%;font-size:${dims.font}px;margin:0 auto 10px;background:${color}">${initials(p.name)}</div>
      <div class="org-dept-label" style="color:${color}">${area || ' '}</div>
      <div class="org-name">${p.name}</div>
      <div class="org-role">${p.rol || 'Sin puesto'}</div>
      ${count ? `<div class="badge-team" style="background:${color}1a;color:${color}">${count} ${count === 1 ? 'persona' : 'personas'}</div>` : ''}
      ${kids.length ? `<div class="org-hint" style="color:${color}">Ver equipo (${kids.length}) →</div>` : ''}
    </div>
  </div>`;
}

function teamSize(id, childrenMap, visited) {
  if (visited.has(id)) return 0;
  visited.add(id);
  const kids = childrenMap[id] || [];
  return kids.reduce((sum, k) => sum + 1 + teamSize(k.id, childrenMap, visited), 0);
}
