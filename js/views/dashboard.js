import { achievement, statusOf, avgAchievement, clienteName, personaName } from '../calc.js';
import { visibleClientes, visiblePersonas, visibleKpis, visibleKpisByCliente, visibleKpisByPersona } from '../permissions.js';
import { kpiRowHtml } from '../utils.js';

let chartClientes = null;
let chartEquipo = null;

export function renderDashboard() {
  const kpis = visibleKpis();
  const total = kpis.length;
  const enMeta = kpis.filter((k) => statusOf(achievement(k)) === 'ok').length;
  const enRiesgo = kpis.filter((k) => statusOf(achievement(k)) === 'warn').length;
  const critico = kpis.filter((k) => statusOf(achievement(k)) === 'bad').length;
  const promedio = total ? Math.round(avgAchievement(kpis)) : 0;

  document.getElementById('dash-stats').innerHTML = [
    { label: 'Cumplimiento promedio', value: `${promedio}%`, sub: `${total} KPIs activos` },
    { label: 'En meta', value: enMeta, color: 'var(--verde)', sub: `de ${total} KPIs` },
    { label: 'En riesgo', value: enRiesgo, color: 'var(--amarillo)', sub: 'requieren seguimiento' },
    { label: 'Críticos', value: critico, color: 'var(--rojo)', sub: 'acción inmediata' },
  ]
    .map(
      ({ label, value, color, sub }) =>
        `<div class="stat-card"><div class="sq"></div><div class="label">${label}</div><div class="value"${color ? ` style="color:${color}"` : ''}>${value}</div><div class="sub">${sub}</div></div>`,
    )
    .join('');

  const clientes = visibleClientes();
  const clienteLabels = clientes.map((c) => c.name);
  const clienteData = clientes.map((c) => Math.round(avgAchievement(visibleKpisByCliente(c.id))));
  if (chartClientes) chartClientes.destroy();
  chartClientes = new Chart(document.getElementById('chart-clientes'), {
    type: 'bar',
    data: { labels: clienteLabels, datasets: [{ data: clienteData, backgroundColor: '#19199A', borderRadius: 5, maxBarThickness: 36 }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { callback: (v) => v + '%' } } } },
  });

  const personas = visiblePersonas();
  const personaLabels = personas.map((p) => p.name);
  const personaData = personas.map((p) => Math.round(avgAchievement(visibleKpisByPersona(p.id))));
  if (chartEquipo) chartEquipo.destroy();
  chartEquipo = new Chart(document.getElementById('chart-equipo'), {
    type: 'bar',
    data: { labels: personaLabels, datasets: [{ data: personaData, backgroundColor: '#EE7D38', borderRadius: 5, maxBarThickness: 36 }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { callback: (v) => v + '%' } } } },
  });

  const riesgo = kpis.filter((k) => statusOf(achievement(k)) !== 'ok').sort((a, b) => achievement(a) - achievement(b));
  const cont = document.getElementById('dash-riesgo');
  cont.innerHTML = riesgo.length
    ? riesgo.map((k) => kpiRowHtml(k, `${clienteName(k.clienteId)} · Responsable: ${personaName(k.personaId)}`)).join('')
    : `<div class="empty">Todos los KPIs están en meta. Buen trabajo.</div>`;
}
