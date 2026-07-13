import { appData } from '../state.js';
import { achievement, statusOf, statusLabel, latestHCByArea } from '../calc.js';
import { tenureYears, fmtYears, tenureBuckets } from '../utils.js';

let currentSubtab = 'hc';
let chartHC = null,
  chartBajas = null,
  chartRotacion = null,
  chartAntiguedad = null,
  chartAntiguedadPuesto = null;

export function switchSubtab(name) {
  currentSubtab = name;
  document.querySelectorAll('.subtab').forEach((t) => t.classList.remove('active'));
  document.querySelector(`.subtab[data-subtab="${name}"]`).classList.add('active');
  document.querySelectorAll('.subview').forEach((v) => v.classList.remove('active'));
  document.getElementById('subview-' + name).classList.add('active');
  if (name === 'hc') renderHC();
  if (name === 'bajas') renderBajas();
  if (name === 'rotacion') renderRotacion();
  if (name === 'antiguedad') renderAntiguedad();
  if (name === 'antiguedad-puesto') renderAntiguedadPuesto();
}

export function renderPeopleView() {
  switchSubtab(currentSubtab);
}

document.querySelectorAll('.subtab').forEach((t) => {
  t.addEventListener('click', () => switchSubtab(t.dataset.subtab));
});

/* ---- HC ---- */
function renderHC() {
  const latest = latestHCByArea();
  const totalActual = latest.reduce((a, r) => a + Number(r.headcount || 0), 0);
  const totalMeta = latest.reduce((a, r) => a + Number(r.meta || 0), 0);
  const cumplimiento = totalMeta ? Math.round((totalActual / totalMeta) * 100) : null;
  document.getElementById('hc-stats').innerHTML = `
    <div class="stat-card"><div class="sq"></div><div class="label">Headcount actual</div><div class="value">${totalActual}</div><div class="sub">último período por área</div></div>
    <div class="stat-card"><div class="sq"></div><div class="label">Meta de headcount</div><div class="value">${totalMeta || '—'}</div><div class="sub">suma de metas por área</div></div>
    <div class="stat-card"><div class="sq"></div><div class="label">Cumplimiento</div><div class="value" style="color:${cumplimiento === null ? 'inherit' : statusOf(cumplimiento) === 'ok' ? 'var(--verde)' : statusOf(cumplimiento) === 'warn' ? 'var(--amarillo)' : 'var(--rojo)'}">${cumplimiento !== null ? cumplimiento + '%' : '—'}</div><div class="sub">vs meta total</div></div>
    <div class="stat-card"><div class="sq"></div><div class="label">Áreas registradas</div><div class="value">${latest.length}</div><div class="sub">con headcount activo</div></div>
  `;
  if (chartHC) chartHC.destroy();
  if (latest.length) {
    chartHC = new Chart(document.getElementById('chart-hc'), {
      type: 'bar',
      data: {
        labels: latest.map((r) => r.area),
        datasets: [
          { label: 'Actual', data: latest.map((r) => r.headcount), backgroundColor: '#19199A', borderRadius: 5, maxBarThickness: 32 },
          { label: 'Meta', data: latest.map((r) => r.meta || 0), backgroundColor: '#E8E7E7', borderRadius: 5, maxBarThickness: 32 },
        ],
      },
      options: {
        plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } },
        scales: { y: { beginAtZero: true } },
      },
    });
  }
  const rows = [...appData.headcount].sort((a, b) => b.periodo.localeCompare(a.periodo) || a.area.localeCompare(b.area));
  const tbody = document.querySelector('#hc-table tbody');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty">Aún no hay datos de headcount para mostrar.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows
    .map((r) => {
      const pct = r.meta ? Math.round((r.headcount / r.meta) * 100) : null;
      const st = pct === null ? null : statusOf(pct);
      return `<tr>
      <td><strong>${r.area}</strong></td>
      <td>${r.periodo}</td>
      <td>${r.meta || '—'}</td>
      <td>${r.headcount}</td>
      <td>${pct !== null ? `<span class="badge ${st}">${pct}%</span>` : '—'}</td>
    </tr>`;
    })
    .join('');
}

/* ---- BAJAS ---- */
function renderBajas() {
  const bajas = appData.bajas;
  const now = new Date();
  const esteMes = bajas.filter((b) => {
    const d = new Date(b.fecha + 'T00:00:00');
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
  const voluntarias = bajas.filter((b) => b.tipo === 'Voluntaria').length;
  const involuntarias = bajas.filter((b) => b.tipo === 'Involuntaria').length;
  document.getElementById('bajas-stats').innerHTML = `
    <div class="stat-card"><div class="sq"></div><div class="label">Bajas totales</div><div class="value">${bajas.length}</div><div class="sub">histórico registrado</div></div>
    <div class="stat-card"><div class="sq"></div><div class="label">Bajas este mes</div><div class="value">${esteMes}</div><div class="sub">mes en curso</div></div>
    <div class="stat-card"><div class="sq"></div><div class="label">Voluntarias</div><div class="value" style="color:var(--amarillo)">${voluntarias}</div><div class="sub">por decisión del colaborador</div></div>
    <div class="stat-card"><div class="sq"></div><div class="label">Involuntarias</div><div class="value" style="color:var(--rojo)">${involuntarias}</div><div class="sub">por decisión de la empresa</div></div>
  `;
  const areas = [...new Set(bajas.map((b) => b.area))];
  const areaData = areas.map((a) => bajas.filter((b) => b.area === a).length);
  if (chartBajas) chartBajas.destroy();
  if (areas.length) {
    chartBajas = new Chart(document.getElementById('chart-bajas'), {
      type: 'bar',
      data: { labels: areas, datasets: [{ data: areaData, backgroundColor: '#EE7D38', borderRadius: 5, maxBarThickness: 36 }] },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } },
    });
  }
  const rows = [...bajas].sort((a, b) => b.fecha.localeCompare(a.fecha));
  const tbody = document.querySelector('#bajas-table tbody');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty">Aún no hay bajas registradas.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows
    .map(
      (b) => `<tr>
    <td><strong>${b.empleado}</strong></td>
    <td>${b.area}</td>
    <td>${b.fecha}</td>
    <td><span class="badge ${b.tipo === 'Voluntaria' ? 'warn' : 'bad'}">${b.tipo}</span></td>
    <td>${b.motivo || '—'}</td>
  </tr>`,
    )
    .join('');
}

/* ---- ROTACIÓN ---- */
function renderRotacion() {
  const now = new Date();
  const hace12m = new Date();
  hace12m.setFullYear(hace12m.getFullYear() - 1);
  const bajas12m = appData.bajas.filter((b) => new Date(b.fecha + 'T00:00:00') >= hace12m);
  const hcActual = latestHCByArea().reduce((a, r) => a + Number(r.headcount || 0), 0);
  const rotacion = hcActual ? (bajas12m.length / hcActual) * 100 : 0;
  const meta = appData.rotacionMeta;
  const fakeKpi = { meta, actual: rotacion, direccion: 'down' };
  const pct = achievement(fakeKpi);
  const st = statusOf(pct);
  document.getElementById('rotacion-stats').innerHTML = `
    <div class="stat-card"><div class="sq"></div><div class="label">Rotación anualizada</div><div class="value">${rotacion.toFixed(1)}%</div><div class="sub">últimos 12 meses</div></div>
    <div class="stat-card"><div class="sq"></div><div class="label">Meta anual</div><div class="value">${meta}%</div><div class="sub">menor es mejor</div></div>
    <div class="stat-card"><div class="sq"></div><div class="label">Estado</div><div class="value" style="font-size:18px;margin-top:10px;"><span class="badge ${st}">${statusLabel(st)}</span></div></div>
    <div class="stat-card"><div class="sq"></div><div class="label">Bajas consideradas</div><div class="value">${bajas12m.length}</div><div class="sub">vs headcount actual (${hcActual})</div></div>
  `;
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ label: d.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' }), year: d.getFullYear(), month: d.getMonth() });
  }
  const data = months.map(
    (m) =>
      appData.bajas.filter((b) => {
        const d = new Date(b.fecha + 'T00:00:00');
        return d.getFullYear() === m.year && d.getMonth() === m.month;
      }).length,
  );
  if (chartRotacion) chartRotacion.destroy();
  chartRotacion = new Chart(document.getElementById('chart-rotacion'), {
    type: 'bar',
    data: { labels: months.map((m) => m.label), datasets: [{ data, backgroundColor: '#4C4DF6', borderRadius: 5, maxBarThickness: 26 }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } },
  });
}

/* ---- ANTIGÜEDAD ---- */
function renderAntiguedad() {
  const emps = appData.empleados.filter((e) => e.fechaIngreso);
  const years = emps.map((e) => tenureYears(e.fechaIngreso));
  const promedio = years.length ? years.reduce((a, b) => a + b, 0) / years.length : 0;
  const menor1 = years.filter((y) => y < 1).length;
  const mayor5 = years.filter((y) => y >= 5).length;
  document.getElementById('antiguedad-stats').innerHTML = `
    <div class="stat-card"><div class="sq"></div><div class="label">Antigüedad promedio</div><div class="value">${fmtYears(promedio)}</div><div class="sub">${emps.length} empleados registrados</div></div>
    <div class="stat-card"><div class="sq"></div><div class="label">Menos de 1 año</div><div class="value" style="color:var(--amarillo)">${menor1}</div><div class="sub">posible riesgo de fuga temprana</div></div>
    <div class="stat-card"><div class="sq"></div><div class="label">5 años o más</div><div class="value" style="color:var(--verde)">${mayor5}</div><div class="sub">colaboradores consolidados</div></div>
    <div class="stat-card"><div class="sq"></div><div class="label">Total registrados</div><div class="value">${emps.length}</div><div class="sub">con fecha de ingreso</div></div>
  `;
  const buckets = tenureBuckets(years);
  if (chartAntiguedad) chartAntiguedad.destroy();
  chartAntiguedad = new Chart(document.getElementById('chart-antiguedad'), {
    type: 'bar',
    data: {
      labels: Object.keys(buckets),
      datasets: [{ data: Object.values(buckets), backgroundColor: '#19199A', borderRadius: 5, maxBarThickness: 40 }],
    },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } },
  });
  const tbody = document.querySelector('#antiguedad-table tbody');
  if (!appData.empleados.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty">Aún no hay empleados registrados.</td></tr>`;
    return;
  }
  const rows = [...appData.empleados].sort((a, b) => (a.fechaIngreso || '').localeCompare(b.fechaIngreso || ''));
  tbody.innerHTML = rows
    .map(
      (e) => `<tr>
    <td><strong>${e.nombre}</strong></td>
    <td>${e.area || '—'}</td>
    <td>${e.fechaIngreso || '—'}</td>
    <td>${fmtYears(tenureYears(e.fechaIngreso))}</td>
  </tr>`,
    )
    .join('');
}

/* ---- ANTIGÜEDAD EN EL PUESTO ---- */
function renderAntiguedadPuesto() {
  const emps = appData.empleados.filter((e) => e.fechaPuesto);
  const years = emps.map((e) => tenureYears(e.fechaPuesto));
  const promedio = years.length ? years.reduce((a, b) => a + b, 0) / years.length : 0;
  const estancados = years.filter((y) => y >= 3).length;
  document.getElementById('antiguedad-puesto-stats').innerHTML = `
    <div class="stat-card"><div class="sq"></div><div class="label">Antigüedad promedio en puesto</div><div class="value">${fmtYears(promedio)}</div><div class="sub">${emps.length} empleados registrados</div></div>
    <div class="stat-card"><div class="sq"></div><div class="label">3+ años en el mismo puesto</div><div class="value" style="color:var(--amarillo)">${estancados}</div><div class="sub">candidatos a revisar plan de carrera</div></div>
    <div class="stat-card"><div class="sq"></div><div class="label">Total registrados</div><div class="value">${emps.length}</div><div class="sub">con fecha en el puesto</div></div>
  `;
  const buckets = tenureBuckets(years);
  if (chartAntiguedadPuesto) chartAntiguedadPuesto.destroy();
  chartAntiguedadPuesto = new Chart(document.getElementById('chart-antiguedad-puesto'), {
    type: 'bar',
    data: {
      labels: Object.keys(buckets),
      datasets: [{ data: Object.values(buckets), backgroundColor: '#EE7D38', borderRadius: 5, maxBarThickness: 40 }],
    },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } },
  });
  const tbody = document.querySelector('#antiguedad-puesto-table tbody');
  if (!appData.empleados.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty">Aún no hay empleados registrados.</td></tr>`;
    return;
  }
  const rows = [...appData.empleados].sort((a, b) => (a.fechaPuesto || '').localeCompare(b.fechaPuesto || ''));
  tbody.innerHTML = rows
    .map(
      (e) => `<tr>
    <td><strong>${e.nombre}</strong></td>
    <td>${e.area || '—'}</td>
    <td>${e.fechaPuesto || '—'}</td>
    <td>${fmtYears(tenureYears(e.fechaPuesto))}</td>
  </tr>`,
    )
    .join('');
}
