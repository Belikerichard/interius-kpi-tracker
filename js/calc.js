import { appData } from './state.js';

export function achievement(kpi) {
  const meta = Number(kpi.meta),
    actual = Number(kpi.actual);
  if (!meta) return 0;
  let pct;
  if (kpi.direccion === 'down') {
    pct = actual === 0 ? 100 : (meta / actual) * 100;
  } else {
    pct = (actual / meta) * 100;
  }
  return Math.max(0, pct);
}

export function statusOf(pct) {
  if (pct >= 95) return 'ok';
  if (pct >= 75) return 'warn';
  return 'bad';
}

export function statusLabel(s) {
  return s === 'ok' ? 'En meta' : s === 'warn' ? 'En riesgo' : 'Crítico';
}

export function ratingFromScore(avg) {
  if (avg >= 95) return { label: 'Excelente', color: 'var(--verde)' };
  if (avg >= 80) return { label: 'Bueno', color: 'var(--azul-brillante)' };
  if (avg >= 60) return { label: 'Regular', color: 'var(--amarillo)' };
  return { label: 'Necesita atención', color: 'var(--rojo)' };
}

export function kpisByCliente(id) {
  return appData.kpis.filter((k) => k.clienteId === id);
}

export function kpisByPersona(id) {
  return appData.kpis.filter((k) => k.personaId === id);
}

export function avgAchievement(kpis) {
  if (!kpis.length) return 0;
  const capped = kpis.map((k) => Math.min(achievement(k), 130));
  return capped.reduce((a, b) => a + b, 0) / capped.length;
}

export function clienteName(id) {
  const c = appData.clientes.find((x) => x.id === id);
  return c ? c.name : '—';
}

export function personaName(id) {
  const p = appData.personas.find((x) => x.id === id);
  return p ? p.name : 'Sin asignar';
}

export function latestHCByArea() {
  const map = {};
  appData.headcount.forEach((r) => {
    if (!map[r.area] || r.periodo > map[r.area].periodo) map[r.area] = r;
  });
  return Object.values(map);
}
