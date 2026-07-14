import { achievement, statusOf, avgAchievement, clienteName, personaName } from '../calc.js';
import { visibleClientes, visiblePersonas, visibleKpis, visibleKpisByCliente, visibleKpisByPersona } from '../permissions.js';

let chartClientes = null;
let chartEquipo = null;

export function renderDashboard() {
  const kpis = visibleKpis();
  const total = kpis.length;
  const enMeta = kpis.filter((k) => statusOf(achievement(k)) === 'ok').length;
  const enRiesgo = kpis.filter((k) => statusOf(achievement(k)) === 'warn').length;
  const critico = kpis.filter((k) => statusOf(achievement(k)) === 'bad').length;
  const promedio = total ? Math.round(avgAchievement(kpis)) : 0;

  document.getElementById('dash-stats').innerHTML = `
    <div class="stat-card"><div class="sq"></div><div class="label">Cumplimiento promedio</div><div class="value">${promedio}%</div><div class="sub">${total} KPIs activos</div></div>
    <div class="stat-card"><div class="sq"></div><div class="label">En meta</div><div class="value" style="color:var(--verde)">${enMeta}</div><div class="sub">de ${total} KPIs</div></div>
    <div class="stat-card"><div class="sq"></div><div class="label">En riesgo</div><div class="value" style="color:var(--amarillo)">${enRiesgo}</div><div class="sub">requieren seguimiento</div></div>
    <div class="stat-card"><div class="sq"></div><div class="label">Críticos</div><div class="value" style="color:var(--rojo)">${critico}</div><div class="sub">acción inmediata</div></div>
  `;

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
  if (!riesgo.length) {
    cont.innerHTML = `<div class="empty">Todos los KPIs están en meta. Buen trabajo.</div>`;
  } else {
    cont.innerHTML = riesgo
      .map((k) => {
        const pct = achievement(k);
        const st = statusOf(pct);
        return `<div class="kpi-list-item">
        <div>
          <div class="name">${k.name}</div>
          <div class="meta">${clienteName(k.clienteId)} · Responsable: ${personaName(k.personaId)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <span class="meta">${k.actual}${k.unidad} / meta ${k.meta}${k.unidad}</span>
          <span class="badge ${st}">${Math.round(pct)}%</span>
        </div>
      </div>`;
      })
      .join('');
  }
}
