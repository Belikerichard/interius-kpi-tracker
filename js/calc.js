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

/* Headcount real (activos por Estatus) a una fecha de corte (YYYY-MM-DD),
   reconstruido con Fecha de Contratación: cuenta a quien ya había sido
   contratado para esa fecha y, si después causó baja, la baja fue posterior
   al corte. appData.empleados ya son solo los "Activo" de hoy; appData.bajas
   trae su fechaIngreso para poder ubicarlos en meses donde seguían activos. */
export function headcountAsOf(cutoffIso) {
  const activos = appData.empleados.filter((e) => e.fechaIngreso && e.fechaIngreso <= cutoffIso);
  const exActivos = appData.bajas.filter((b) => b.fechaIngreso && b.fechaIngreso <= cutoffIso && b.fecha > cutoffIso);
  return [...activos.map((e) => ({ area: e.area })), ...exActivos.map((b) => ({ area: b.area }))];
}

export function lastDayOfMonth(year, month) {
  const day = new Date(year, month + 1, 0).getDate();
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function pctChange(curr, prev) {
  if (!prev) return null;
  return ((curr - prev) / prev) * 100;
}
