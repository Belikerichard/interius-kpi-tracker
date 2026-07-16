import { appData } from '../state.js';
import { achievement, statusOf, statusLabel, latestHCByArea, headcountAsOf, lastDayOfMonth, pctChange } from '../calc.js';
import { tenureYears, fmtYears, tenureBuckets } from '../utils.js';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const today = new Date();
let hcFiltro = { year: today.getFullYear(), month: today.getMonth() }; // month: 0-11

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
function countByArea(roster) {
  const map = {};
  roster.forEach((r) => (map[r.area] = (map[r.area] || 0) + 1));
  return map;
}

function growthSub(pct) {
  if (pct === null) return 'sin dato del período anterior';
  const arrow = pct > 0 ? '▲' : pct < 0 ? '▼' : '—';
  return `${arrow} ${Math.abs(pct).toFixed(1)}%`;
}

function growthColor(pct) {
  if (pct === null) return 'inherit';
  return pct > 0 ? 'var(--verde)' : pct < 0 ? 'var(--rojo)' : 'inherit';
}

function renderHCFiltro() {
  const years = new Set([today.getFullYear()]);
  [...appData.empleados, ...appData.bajas].forEach((r) => {
    if (r.fechaIngreso) years.add(Number(r.fechaIngreso.slice(0, 4)));
  });
  const yearOpts = [...years]
    .sort((a, b) => b - a)
    .map((y) => `<option value="${y}" ${y === hcFiltro.year ? 'selected' : ''}>${y}</option>`)
    .join('');
  const monthOpts = MESES.map((m, i) => `<option value="${i}" ${i === hcFiltro.month ? 'selected' : ''}>${m}</option>`).join('');
  document.getElementById('hc-filtro').innerHTML = `
    <select id="hc-mes">${monthOpts}</select>
    <select id="hc-anio">${yearOpts}</select>
  `;
  document.getElementById('hc-mes').addEventListener('change', (e) => {
    hcFiltro.month = Number(e.target.value);
    renderHC();
  });
  document.getElementById('hc-anio').addEventListener('change', (e) => {
    hcFiltro.year = Number(e.target.value);
    renderHC();
  });
}

function renderHC() {
  renderHCFiltro();

  const { year, month } = hcFiltro;
  const cutoff = lastDayOfMonth(year, month);
  const cutoffPrevMonth = lastDayOfMonth(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1);
  const cutoffPrevYear = lastDayOfMonth(year - 1, month);

  const roster = headcountAsOf(cutoff);
  const totalActual = roster.length;
  const totalPrevMonth = headcountAsOf(cutoffPrevMonth).length;
  const totalPrevYear = headcountAsOf(cutoffPrevYear).length;
  const crecMoM = pctChange(totalActual, totalPrevMonth);
  const crecYoY = pctChange(totalActual, totalPrevYear);

  const metaByArea = Object.fromEntries(latestHCByArea().map((r) => [r.area, Number(r.meta || 0)]));
  const totalMeta = Object.values(metaByArea).reduce((a, b) => a + b, 0);
  const cumplimiento = totalMeta ? Math.round((totalActual / totalMeta) * 100) : null;

  const cumplColor = cumplimiento === null ? 'inherit' : statusOf(cumplimiento) === 'ok' ? 'var(--verde)' : statusOf(cumplimiento) === 'warn' ? 'var(--amarillo)' : 'var(--rojo)';
  document.getElementById('hc-stats').innerHTML = `
    <div class="stat-card" style="grid-column:1/-1">
      <div class="sq"></div>
      <div class="label">Headcount actual</div>
      <div class="value">${totalActual}</div>
      <div class="sub">activos a ${MESES[month]} ${year} (Estatus = Activo) · meta total ${totalMeta || '—'}</div>
      <div style="display:flex;gap:28px;flex-wrap:wrap;margin-top:14px;padding-top:14px;border-top:1px solid #eeeef4">
        <div><div class="sub" style="margin:0">vs mes anterior</div><strong style="color:${growthColor(crecMoM)}">${growthSub(crecMoM)}</strong> <span class="sub" style="margin:0">(${totalPrevMonth} → ${totalActual})</span></div>
        <div><div class="sub" style="margin:0">vs año anterior</div><strong style="color:${growthColor(crecYoY)}">${growthSub(crecYoY)}</strong> <span class="sub" style="margin:0">(${totalPrevYear} → ${totalActual})</span></div>
        <div><div class="sub" style="margin:0">cumplimiento vs meta</div><strong style="color:${cumplColor}">${cumplimiento !== null ? cumplimiento + '%' : '—'}</strong></div>
      </div>
    </div>
  `;

  const countsByArea = countByArea(roster);
  const areas = [...new Set([...Object.keys(countsByArea), ...Object.keys(metaByArea)])].sort();

  if (chartHC) chartHC.destroy();
  if (areas.length) {
    chartHC = new Chart(document.getElementById('chart-hc'), {
      type: 'bar',
      data: {
        labels: areas,
        datasets: [
          { label: 'Actual', data: areas.map((a) => countsByArea[a] || 0), backgroundColor: '#19199A', borderRadius: 5, maxBarThickness: 32 },
          { label: 'Meta', data: areas.map((a) => metaByArea[a] || 0), backgroundColor: '#E8E7E7', borderRadius: 5, maxBarThickness: 32 },
        ],
      },
      options: {
        plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } },
        scales: { y: { beginAtZero: true } },
      },
    });
  }

  const tbody = document.querySelector('#hc-table tbody');
  if (!areas.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty">Aún no hay datos de headcount para mostrar.</td></tr>`;
    return;
  }
  tbody.innerHTML = areas
    .map((area) => {
      const actual = countsByArea[area] || 0;
      const meta = metaByArea[area] || 0;
      const pct = meta ? Math.round((actual / meta) * 100) : null;
      const st = pct === null ? null : statusOf(pct);
      return `<tr>
      <td><strong>${area}</strong></td>
      <td>${year}-${String(month + 1).padStart(2, '0')}</td>
      <td>${meta || '—'}</td>
      <td>${actual}</td>
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
