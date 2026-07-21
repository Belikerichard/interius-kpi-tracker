import { appData } from '../state.js';
import { tenureYears, fmtYears, tenureBuckets, PALETTE } from '../utils.js';

let currentSubtab = 'estructura';
let chartArea = null,
  chartNivel = null,
  chartPiramide = null,
  chartSpanControl = null,
  chartAntigArea = null,
  chartAntigNivel = null,
  chartAntigHist = null,
  chartSexo = null,
  chartSexoNivel = null,
  chartEdadHist = null,
  chartEdadNivel = null,
  chartEdadAntiguedad = null,
  chartAltasMes = null,
  chartAltasArea = null,
  chartCrecimientoAcumulado = null,
  chartLideres = null;

const NIVEL_ORDEN = ['CEO', 'Manager', 'Jr Manager', 'Sr Consultant', 'Consultant', 'Jr Consultant', 'Specialist', 'Analyst', 'Trainee', 'Sin definir'];
const AREAS_ORDEN = ['SEO', 'Inbound Marketing', 'Publicidad Digital', 'Estrategia Digital', 'Administración & Recursos Humanos', 'Sin área'];
const LIDERES = new Set(['CEO', 'Manager', 'Jr Manager', 'Executive']);
const NIVELES_JR = new Set(['Specialist', 'Jr Consultant', 'Jr Manager']);

export function switchSubtab(name) {
  currentSubtab = name;
  document.querySelectorAll('.subtab').forEach((t) => t.classList.remove('active'));
  document.querySelector(`.subtab[data-subtab="${name}"]`).classList.add('active');
  document.querySelectorAll('.subview').forEach((v) => v.classList.remove('active'));
  document.getElementById('subview-' + name).classList.add('active');
  if (name === 'estructura') renderEstructura();
  if (name === 'antiguedad') renderAntiguedad();
  if (name === 'demografia') renderDemografia();
  if (name === 'contrataciones') renderContrataciones();
  if (name === 'calidad') renderCalidad();
  if (name === 'cruces') renderCruces();
}

export function renderPeopleView() {
  switchSubtab(currentSubtab);
}

document.querySelectorAll('.subtab').forEach((t) => {
  t.addEventListener('click', () => switchSubtab(t.dataset.subtab));
});

/* ---- helpers compartidos ---- */
function activos() {
  return appData.empleados.map((e) => ({ ...e, nivel: e.nivelPuesto || 'Sin definir', antiguedad: tenureYears(e.fechaIngreso) }));
}

function avg(nums) {
  const vals = nums.filter((n) => n !== null && n !== undefined && !Number.isNaN(n));
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function groupBy(items, keyFn) {
  const map = {};
  items.forEach((it) => {
    const k = keyFn(it);
    (map[k] ||= []).push(it);
  });
  return map;
}

/* Chart.js no envuelve etiquetas largas por su cuenta: si no rota el texto,
   las etiquetas que no caben se solapan o se saltan. Partirlas en líneas
   (arreglo de strings) sí las muestra en varios renglones, horizontales. */
function wrapLabel(label, maxLen = 14) {
  if (label.length <= maxLen) return label;
  const words = label.split(' ');
  const lines = [];
  let current = '';
  for (const w of words) {
    if (current && (current + ' ' + w).length > maxLen) {
      lines.push(current);
      current = w;
    } else {
      current = current ? `${current} ${w}` : w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/* Antepone el orden conocido, pero nunca descarta valores reales que no
   estén en la lista (ej. si agregan un área nueva en el Sheet) — se
   agregan al final en vez de desaparecer en silencio de las gráficas. */
function orderedKeys(present, order) {
  const known = order.filter((k) => present.has(k));
  const extra = [...present].filter((k) => !order.includes(k)).sort();
  return [...known, ...extra];
}

/* ---- 1. ESTRUCTURA ORGANIZACIONAL ---- */
function renderEstructura() {
  const emp = activos();
  document.getElementById('estructura-stats').innerHTML = `
    <div class="stat-card" style="grid-column:1/-1"><div class="sq"></div><div class="label">Headcount total activo</div><div class="value">${emp.length}</div><div class="sub">colaboradores con Estatus = Activo</div></div>
  `;

  const byArea = groupBy(emp, (e) => e.area);
  const areas = orderedKeys(new Set(Object.keys(byArea)), AREAS_ORDEN);
  if (chartArea) chartArea.destroy();
  chartArea = new Chart(document.getElementById('chart-area'), {
    type: 'bar',
    data: { labels: areas.map(wrapLabel), datasets: [{ data: areas.map((a) => byArea[a].length), backgroundColor: '#19199A', borderRadius: 5, maxBarThickness: 40 }] },
    options: {
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: { x: { ticks: { maxRotation: 0, minRotation: 0, autoSkip: false } }, y: { beginAtZero: true, ticks: { stepSize: 1 } } },
    },
  });

  const byNivel = groupBy(emp, (e) => e.nivel);
  const niveles = orderedKeys(new Set(Object.keys(byNivel)), NIVEL_ORDEN);
  if (chartNivel) chartNivel.destroy();
  chartNivel = new Chart(document.getElementById('chart-nivel'), {
    type: 'bar',
    data: { labels: niveles.map((n) => wrapLabel(n, 9)), datasets: [{ data: niveles.map((n) => byNivel[n].length), backgroundColor: '#4C4DF6', borderRadius: 5, maxBarThickness: 40 }] },
    options: {
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: { x: { ticks: { maxRotation: 0, minRotation: 0, autoSkip: false, font: { size: 10 } } }, y: { beginAtZero: true, ticks: { stepSize: 1 } } },
    },
  });

  if (chartPiramide) chartPiramide.destroy();
  chartPiramide = new Chart(document.getElementById('chart-piramide'), {
    type: 'bar',
    data: { labels: niveles, datasets: [{ data: niveles.map((n) => Math.round((byNivel[n].length / emp.length) * 1000) / 10), backgroundColor: '#EE7D38', borderRadius: 5 }] },
    options: {
      indexAxis: 'y',
      plugins: { legend: { display: false }, tooltip: { enabled: false }, valueLabels: { suffix: '%' } },
      scales: { x: { beginAtZero: true, ticks: { callback: (v) => v + '%' } }, y: { ticks: { autoSkip: false } } },
    },
  });

  const byId = Object.fromEntries(emp.map((e) => [e.id, e]));
  const reportCounts = {};
  emp.forEach((e) => {
    if (e.reportsTo) reportCounts[e.reportsTo] = (reportCounts[e.reportsTo] || 0) + 1;
  });
  const managers = Object.entries(reportCounts)
    .map(([id, count]) => ({ id, nombre: byId[id]?.nombre || id, count }))
    .sort((a, b) => b.count - a.count);
  const top15 = managers.slice(0, 15);

  if (chartSpanControl) chartSpanControl.destroy();
  chartSpanControl = new Chart(document.getElementById('chart-span-control'), {
    type: 'bar',
    data: { labels: top15.map((m) => m.nombre), datasets: [{ data: top15.map((m) => m.count), backgroundColor: '#1E9E6B', borderRadius: 5 }] },
    options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } } },
  });

  const tbody = document.querySelector('#span-control-table tbody');
  tbody.innerHTML = managers.length
    ? managers.map((m) => `<tr><td><strong>${m.nombre}</strong></td><td>${m.count}</td></tr>`).join('')
    : `<tr><td colspan="2" class="empty">Nadie tiene reportes directos registrados.</td></tr>`;
}

/* ---- 2. ANTIGÜEDAD ---- */
function renderAntiguedad() {
  const emp = activos().filter((e) => e.antiguedad !== null);
  const avgAntig = avg(emp.map((e) => e.antiguedad));
  const menos6m = emp.filter((e) => e.antiguedad < 0.5).length;
  document.getElementById('antiguedad-stats').innerHTML = `
    <div class="stat-card"><div class="sq"></div><div class="label">Antigüedad promedio</div><div class="value">${fmtYears(avgAntig)}</div><div class="sub">${emp.length} colaboradores con fecha de ingreso</div></div>
    <div class="stat-card"><div class="sq"></div><div class="label">Menos de 6 meses</div><div class="value" style="color:var(--amarillo)">${menos6m}</div><div class="sub">${emp.length ? Math.round((menos6m / emp.length) * 100) : 0}% de la plantilla</div></div>
  `;

  const byArea = groupBy(emp, (e) => e.area);
  const areas = orderedKeys(new Set(Object.keys(byArea)), AREAS_ORDEN);
  if (chartAntigArea) chartAntigArea.destroy();
  chartAntigArea = new Chart(document.getElementById('chart-antig-area'), {
    type: 'bar',
    data: { labels: areas, datasets: [{ data: areas.map((a) => Number(avg(byArea[a].map((e) => e.antiguedad)).toFixed(1))), backgroundColor: '#19199A', borderRadius: 5 }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
  });

  const byNivel = groupBy(emp, (e) => e.nivel);
  const niveles = orderedKeys(new Set(Object.keys(byNivel)), NIVEL_ORDEN);
  if (chartAntigNivel) chartAntigNivel.destroy();
  chartAntigNivel = new Chart(document.getElementById('chart-antig-nivel'), {
    type: 'bar',
    data: { labels: niveles, datasets: [{ data: niveles.map((n) => Number(avg(byNivel[n].map((e) => e.antiguedad)).toFixed(1))), backgroundColor: '#4C4DF6', borderRadius: 5 }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
  });

  const buckets = tenureBuckets(emp.map((e) => e.antiguedad));
  if (chartAntigHist) chartAntigHist.destroy();
  chartAntigHist = new Chart(document.getElementById('chart-antig-hist'), {
    type: 'bar',
    data: { labels: Object.keys(buckets), datasets: [{ data: Object.values(buckets), backgroundColor: '#EE7D38', borderRadius: 5, maxBarThickness: 60 }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } },
  });
}

/* ---- 3. DEMOGRAFÍA ---- */
function renderDemografia() {
  const emp = activos();

  const bySexo = groupBy(emp, (e) => e.sexo || 'Sin dato');
  const sexos = Object.keys(bySexo);
  if (chartSexo) chartSexo.destroy();
  chartSexo = new Chart(document.getElementById('chart-sexo'), {
    type: 'doughnut',
    data: { labels: sexos, datasets: [{ data: sexos.map((s) => bySexo[s].length), backgroundColor: PALETTE }] },
    options: { plugins: { legend: { position: 'bottom' } } },
  });

  const byNivel = groupBy(emp, (e) => e.nivel);
  const niveles = orderedKeys(new Set(Object.keys(byNivel)), NIVEL_ORDEN);
  if (chartSexoNivel) chartSexoNivel.destroy();
  chartSexoNivel = new Chart(document.getElementById('chart-sexo-nivel'), {
    type: 'bar',
    data: {
      labels: niveles,
      datasets: [
        { label: 'Hombre', data: niveles.map((n) => byNivel[n].filter((e) => e.sexo === 'Hombre').length), backgroundColor: '#19199A', borderRadius: 4 },
        { label: 'Mujer', data: niveles.map((n) => byNivel[n].filter((e) => e.sexo === 'Mujer').length), backgroundColor: '#EE7D38', borderRadius: 4 },
      ],
    },
    options: { plugins: { legend: { display: true, position: 'bottom' } }, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } } } },
  });

  const conEdad = emp.filter((e) => e.edad !== null);
  const edadBuckets = { '<25': 0, '25-30': 0, '30-35': 0, '35+': 0 };
  conEdad.forEach((e) => {
    if (e.edad < 25) edadBuckets['<25']++;
    else if (e.edad < 30) edadBuckets['25-30']++;
    else if (e.edad < 35) edadBuckets['30-35']++;
    else edadBuckets['35+']++;
  });
  if (chartEdadHist) chartEdadHist.destroy();
  chartEdadHist = new Chart(document.getElementById('chart-edad-hist'), {
    type: 'bar',
    data: { labels: Object.keys(edadBuckets), datasets: [{ data: Object.values(edadBuckets), backgroundColor: '#1E9E6B', borderRadius: 5, maxBarThickness: 60 }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } },
  });

  const byNivelEdad = groupBy(conEdad, (e) => e.nivel);
  const nivelesEdad = orderedKeys(new Set(Object.keys(byNivelEdad)), NIVEL_ORDEN);
  if (chartEdadNivel) chartEdadNivel.destroy();
  chartEdadNivel = new Chart(document.getElementById('chart-edad-nivel'), {
    type: 'bar',
    data: { labels: nivelesEdad, datasets: [{ data: nivelesEdad.map((n) => Number(avg(byNivelEdad[n].map((e) => e.edad)).toFixed(1))), backgroundColor: '#4C4DF6', borderRadius: 5 }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
  });

  const nivelesScatter = orderedKeys(new Set(conEdad.map((e) => e.nivel)), NIVEL_ORDEN);
  if (chartEdadAntiguedad) chartEdadAntiguedad.destroy();
  chartEdadAntiguedad = new Chart(document.getElementById('chart-edad-antiguedad'), {
    type: 'scatter',
    data: {
      datasets: nivelesScatter.map((n, i) => ({
        label: n,
        data: conEdad
          .filter((e) => e.nivel === n && e.antiguedad !== null)
          .map((e) => ({ x: e.edad, y: Number(e.antiguedad.toFixed(1)) })),
        backgroundColor: PALETTE[i % PALETTE.length],
      })),
    },
    options: {
      plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } },
      scales: { x: { title: { display: true, text: 'Edad' } }, y: { title: { display: true, text: 'Antigüedad (años)' }, beginAtZero: true } },
    },
  });
}

/* ---- 4. RITMO DE CONTRATACIÓN ---- */
function renderContrataciones() {
  const emp = activos().filter((e) => e.fechaIngreso);
  const now = new Date();

  const months = [];
  for (let i = 17; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ label: d.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' }), key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` });
  }
  const altasPorMes = months.map((m) => emp.filter((e) => e.fechaIngreso.slice(0, 7) === m.key).length);
  if (chartAltasMes) chartAltasMes.destroy();
  chartAltasMes = new Chart(document.getElementById('chart-altas-mes'), {
    type: 'line',
    data: { labels: months.map((m) => m.label), datasets: [{ data: altasPorMes, borderColor: '#19199A', backgroundColor: 'rgba(25,25,154,0.08)', fill: true, tension: 0.3, pointRadius: 3 }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } },
  });

  const desde = months[0].key + '-01';
  const enVentana = emp.filter((e) => e.fechaIngreso >= desde);
  const byArea = groupBy(enVentana, (e) => e.area);
  const areas = orderedKeys(new Set(Object.keys(byArea)), AREAS_ORDEN);
  if (chartAltasArea) chartAltasArea.destroy();
  chartAltasArea = new Chart(document.getElementById('chart-altas-area'), {
    type: 'bar',
    data: { labels: areas, datasets: [{ data: areas.map((a) => byArea[a].length), backgroundColor: '#EE7D38', borderRadius: 5 }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } },
  });

  const ordenados = [...emp].sort((a, b) => a.fechaIngreso.localeCompare(b.fechaIngreso));
  const cumMonths = [];
  if (ordenados.length) {
    const [y0, m0] = ordenados[0].fechaIngreso.slice(0, 7).split('-').map(Number);
    let y = y0,
      m = m0 - 1;
    while (y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth())) {
      cumMonths.push({ label: new Date(y, m, 1).toLocaleDateString('es-MX', { month: 'short', year: '2-digit' }), key: `${y}-${String(m + 1).padStart(2, '0')}` });
      m++;
      if (m > 11) {
        m = 0;
        y++;
      }
    }
  }
  const acumulado = cumMonths.map((mo) => ordenados.filter((e) => e.fechaIngreso.slice(0, 7) <= mo.key).length);
  if (chartCrecimientoAcumulado) chartCrecimientoAcumulado.destroy();
  chartCrecimientoAcumulado = new Chart(document.getElementById('chart-crecimiento-acumulado'), {
    type: 'line',
    data: { labels: cumMonths.map((m) => m.label), datasets: [{ data: acumulado, borderColor: '#1E9E6B', backgroundColor: 'rgba(30,158,107,0.08)', fill: true, tension: 0.2, pointRadius: 0 }] },
    options: { plugins: { legend: { display: false } }, scales: { x: { ticks: { maxTicksLimit: 12 } }, y: { beginAtZero: true } } },
  });
}

/* ---- 5. CALIDAD DE DATOS ---- */
function renderCalidad() {
  const emp = activos();
  const dq = appData.dataQuality || { excluidos: 0, incompletos: [] };
  document.getElementById('calidad-nota').textContent =
    `${dq.excluidos} registro(s) con Estatus = Activo se excluyeron del análisis por venir sin Nombre Completo (filas de plantilla vacías del Sheet).`;

  const pct = emp.length ? Math.round((dq.incompletos.length / emp.length) * 100) : 0;
  document.getElementById('calidad-stats').innerHTML = `
    <div class="stat-card"><div class="sq"></div><div class="label">Registros incompletos</div><div class="value" style="color:${pct ? 'var(--amarillo)' : 'var(--verde)'}">${dq.incompletos.length}</div><div class="sub">${pct}% de la plantilla activa</div></div>
    <div class="stat-card"><div class="sq"></div><div class="label">Registros excluidos</div><div class="value">${dq.excluidos}</div><div class="sub">sin Nombre Completo en el Sheet</div></div>
  `;

  const tbody = document.querySelector('#calidad-table tbody');
  tbody.innerHTML = dq.incompletos.length
    ? dq.incompletos.map((r) => `<tr><td><strong>${r.nombre || r.id}</strong></td><td>${r.campos.join(', ')}</td></tr>`).join('')
    : `<tr><td colspan="2" class="empty">Sin registros con datos incompletos.</td></tr>`;
}

/* ---- 6. CRUCES ESTRATÉGICOS ---- */
function renderCruces() {
  const emp = activos();
  const lideres = emp.filter((e) => LIDERES.has(e.nivel)).length;
  const resto = emp.length - lideres;
  if (chartLideres) chartLideres.destroy();
  chartLideres = new Chart(document.getElementById('chart-lideres'), {
    type: 'bar',
    data: { labels: ['Líderes (Manager/Jr Manager/Executive)', 'Colaboradores'], datasets: [{ data: [lideres, resto], backgroundColor: ['#19199A', '#E8E7E7'], borderRadius: 5 }] },
    options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } } },
  });

  const byId = Object.fromEntries(emp.map((e) => [e.id, e]));
  const reportsByManager = {};
  emp.forEach((e) => {
    if (e.reportsTo) (reportsByManager[e.reportsTo] ||= []).push(e);
  });
  const sucesionRiesgo = Object.entries(reportsByManager)
    .filter(([managerId]) => LIDERES.has(byId[managerId]?.nivel))
    .filter(([, reports]) => !reports.some((r) => r.nivel === 'Sr Consultant' || r.nivel === 'Consultant'))
    .map(([managerId]) => byId[managerId])
    .filter(Boolean);

  document.getElementById('sucesion-alert').innerHTML = sucesionRiesgo.length
    ? sucesionRiesgo
        .map((m) => `<div class="kpi-list-item"><div><div class="name">${m.nombre}</div><div class="meta">${m.area} · ${m.nivel}</div></div><span class="badge warn">Sin sucesor claro</span></div>`)
        .join('')
    : `<div class="empty">Todos los managers tienen un Sr Consultant/Consultant en su equipo.</div>`;

  const estancados = emp.filter((e) => NIVELES_JR.has(e.nivel) && e.antiguedad !== null && e.antiguedad >= 2);
  document.getElementById('estancamiento-alert').innerHTML = estancados.length
    ? estancados
        .map((e) => `<div class="kpi-list-item"><div><div class="name">${e.nombre}</div><div class="meta">${e.area} · ${e.nivel}</div></div><span class="badge warn">${fmtYears(e.antiguedad)}</span></div>`)
        .join('')
    : `<div class="empty">Nadie con 2+ años en Specialist/Jr detectado.</div>`;
}
