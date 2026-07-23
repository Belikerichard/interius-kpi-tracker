import { appData } from '../state.js';
import { initials, PALETTE, withViewTransition } from '../utils.js';
import { visiblePersonas } from '../permissions.js';
import { switchView } from '../nav.js';
import { openPersonaDetalle } from './equipo.js';

let focusId = null; // null = sin selección: entra al CEO si hay uno solo, si no hay un único root muestra todos
let searchQuery = '';
let expandedAll = false; // toggle: árbol completo (todos los niveles) vs. vista contraída de un nivel a la vez

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
      : expandedAll
        ? renderFullTree(roots, childrenMap, empleadoById, colorOf, matchId)
        : renderFocusView(focusId, roots, childrenMap, personaById, empleadoById, colorOf, matchId);

  equalizeLevelCardHeights(wrap);

  wrap.querySelectorAll('[data-orgcard]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.dataset.orgcard;
      if (!expandedAll && el.dataset.hasreports === 'true') {
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

/* align-items:stretch en .org-level solo empareja alturas dentro de cada
   línea cuando el nivel hace wrap a varias filas — dos personas del mismo
   nivel podían verse de distinta altura solo por caer en filas distintas.
   Medimos la tarjeta más alta del nivel completo y la fijamos en todas. */
function equalizeLevelCardHeights(wrap) {
  const cards = [...wrap.querySelectorAll('.org-level .org-card2')];
  if (cards.length < 2) return;
  cards.forEach((c) => (c.style.height = ''));
  const max = Math.max(...cards.map((c) => c.scrollHeight));
  cards.forEach((c) => (c.style.height = `${max}px`));
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
const toggleViewBtn = document.getElementById('org-toggle-view');
toggleViewBtn.addEventListener('click', () => {
  expandedAll = !expandedAll;
  toggleViewBtn.textContent = expandedAll ? 'Vista por niveles' : 'Ver todo el equipo';
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

const CARD_DIMS = {
  lg: { avatar: 68, width: 200, font: 20, minHeight: 236 },
  md: { avatar: 44, width: 150, font: 14, minHeight: 172 },
  xs: { avatar: 20, width: 86, font: 9, minHeight: 0 },
};

function renderCard(p, color, childrenMap, empleadoById, size, isMatch, showHint = true) {
  const kids = childrenMap[p.id] || [];
  const count = teamSize(p.id, childrenMap, new Set());
  const area = empleadoById[p.id]?.area || '';
  const dims = CARD_DIMS[size];
  const compact = size === 'xs';

  return `<div class="org-node">
    <div class="org-card2${compact ? ' org-card2-xs' : ''}${isMatch ? ' org-match' : ''}" style="--org-color:${color};width:${dims.width}px;min-height:${dims.minHeight}px" data-orgcard="${p.id}" data-hasreports="${kids.length > 0}">
      <div class="avatar" style="width:${dims.avatar}px;height:${dims.avatar}px;border-radius:50%;font-size:${dims.font}px;margin:0 auto ${compact ? 4 : 10}px;background:${color}">${initials(p.name)}</div>
      ${compact ? '' : `<div class="org-dept-label" style="color:${color}">${area || ' '}</div>`}
      <div class="org-name">${p.name}</div>
      ${compact ? '' : `<div class="org-role">${p.rol || 'Sin puesto'}</div>`}
      ${!compact && count ? `<div class="badge-team" style="background:${color}1a;color:${color}">${count} ${count === 1 ? 'persona' : 'personas'}</div>` : ''}
      ${kids.length && showHint ? `<div class="org-hint" style="color:${color}">Ver equipo (${kids.length}) →</div>` : ''}
    </div>
  </div>`;
}

/* Árbol completo: todos los niveles a la vez, cada rama anidada bajo su
   manager en vez de navegar nivel por nivel como en renderFocusView.
   Tarjetas compactas (xs) — con el tamaño normal, la organización entera
   no entra sin scroll interminable. */
function renderFullTree(roots, childrenMap, empleadoById, colorOf, matchId) {
  return `<div class="org-tree">${roots.map((r) => renderTreeBranch(r, childrenMap, empleadoById, colorOf, matchId)).join('')}</div>`;
}

function renderTreeBranch(p, childrenMap, empleadoById, colorOf, matchId) {
  const kids = childrenMap[p.id] || [];
  return `<div class="org-branch">
    ${renderCard(p, colorOf[p.id], childrenMap, empleadoById, 'xs', matchId === p.id, false)}
    ${kids.length ? `<div class="org-children">${kids.map((k) => renderTreeBranch(k, childrenMap, empleadoById, colorOf, matchId)).join('')}</div>` : ''}
  </div>`;
}

function teamSize(id, childrenMap, visited) {
  if (visited.has(id)) return 0;
  visited.add(id);
  const kids = childrenMap[id] || [];
  return kids.reduce((sum, k) => sum + 1 + teamSize(k.id, childrenMap, visited), 0);
}
