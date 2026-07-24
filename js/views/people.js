import { appData } from '../state.js';
import { tenureYears, fmtYears, tenureBuckets, PALETTE, showToast } from '../utils.js';
import { canEdit } from '../permissions.js';
import { updateEmpleadoRemoto } from '../data.js';
import { openModal, closeModal } from '../modals.js';

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
  chartLideres = null,
  chartRotacionMensual = null,
  chartRotacionArea = null,
  chartTipoBaja = null,
  chartMotivos = null,
  chartAntiguedadBaja = null;

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
  if (name === 'rotacion') renderRotacion();
  if (name === 'calidad') renderCalidad();
  if (name === 'cruces') renderCruces();
  if (name === 'basedatos') renderBaseDatos();
}

export function renderPeopleView() {
  switchSubtab(currentSubtab);
}

document.querySelectorAll('.subtab').forEach((t) => {
  t.addEventListener('click', () => switchSubtab(t.dataset.subtab));
});

/* ---- filtros de fecha por apartado ----
   Cada subtab tiene su propio rango Desde/Hasta independiente (no uno
   compartido) — así se pidió: filtros dentro de cada apartado. Los
   defaults reproducen la ventana que cada vista mostraba antes de que
   existiera el filtro. Calidad de datos no tiene filtro: audita el estado
   actual de la tabla, no tiene sentido histórico. */
const RANGE_DEFAULTS = {
  estructura: ['', mesActual()],
  antiguedad: ['', mesActual()],
  demografia: ['', mesActual()],
  contrataciones: [mesesAtras(18), mesActual()],
  rotacion: [mesesAtras(12), mesActual()],
  cruces: ['', mesActual()],
};
const RANGE_RENDERERS = {
  estructura: () => renderEstructura(),
  antiguedad: () => renderAntiguedad(),
  demografia: () => renderDemografia(),
  contrataciones: () => renderContrataciones(),
  rotacion: () => renderRotacion(),
  cruces: () => renderCruces(),
};
/* El picker nativo de mes se siente lento si puedes navegar años sin límite
   (Enero 2017 es antes del registro más viejo de la tabla) — acotarlo con
   min/max evita eso y de paso no deja elegir un mes futuro. */
const FECHA_MIN_FILTRO = '2017-01';
Object.entries(RANGE_DEFAULTS).forEach(([prefix, [desde, hasta]]) => {
  const desdeEl = document.getElementById(`${prefix}-desde`);
  const hastaEl = document.getElementById(`${prefix}-hasta`);
  if (desdeEl) {
    desdeEl.value = desde;
    desdeEl.min = FECHA_MIN_FILTRO;
    desdeEl.max = mesActual();
  }
  if (hastaEl) {
    hastaEl.value = hasta;
    hastaEl.min = FECHA_MIN_FILTRO;
    hastaEl.max = mesActual();
  }
  desdeEl?.addEventListener('change', RANGE_RENDERERS[prefix]);
  hastaEl?.addEventListener('change', RANGE_RENDERERS[prefix]);
});

/* ---- helpers compartidos ---- */
function activos() {
  return appData.empleados.map((e) => ({ ...e, nivel: e.nivelPuesto || 'Sin definir', antiguedad: tenureYears(e.fechaIngreso) }));
}

/* ---- reconstrucción histórica ----
   appData.empleados solo trae activos hoy y appData.bajas solo bajas con
   fecha real (el sentinela 12/31/9999 ya se filtró en bigquery.js). Para
   responder "cómo estaba la organización en estas fechas" hace falta unir
   ambas listas con su fechaIngreso/fechaSalida y reconstruir quién estaba
   activo en cualquier fecha pasada. Área/nivel se tratan como constantes
   durante todo el tenure de la persona porque la tabla no registra cambios
   de puesto (ver README) — la misma simplificación que ya usaba el resto
   de esta vista, no es nueva para el filtro de fechas. */
function historico() {
  const activosNow = appData.empleados.map((e) => ({
    id: e.id,
    nombre: e.nombre,
    area: e.area,
    nivel: e.nivelPuesto || 'Sin definir',
    sexo: e.sexo,
    fechaNacimiento: e.fechaNacimiento,
    reportsTo: e.reportsTo,
    fechaIngreso: e.fechaIngreso,
    fechaSalida: null,
  }));
  const bajas = (appData.bajas || []).map((b) => ({
    id: b.id,
    nombre: b.empleado,
    area: b.area,
    nivel: b.nivelPuesto || 'Sin definir',
    sexo: b.sexo,
    fechaNacimiento: b.fechaNacimiento,
    reportsTo: b.reportsTo,
    fechaIngreso: b.fechaIngreso,
    fechaSalida: b.fecha,
    tipo: b.tipo,
    motivo: b.motivo,
    fecha: b.fecha,
  }));
  return { all: [...activosNow, ...bajas], bajas };
}

function headcountAt(dateStr, all, pred = () => true) {
  return all.filter((r) => pred(r) && r.fechaIngreso && r.fechaIngreso <= dateStr && (!r.fechaSalida || r.fechaSalida > dateStr)).length;
}

/* true si el tenure de r se traslapa con [desde, hasta] (desde vacío = sin límite inferior) */
function enRango(r, desde, hasta) {
  if (!r.fechaIngreso || r.fechaIngreso > hasta) return false;
  if (desde && r.fechaSalida && r.fechaSalida < desde) return false;
  return true;
}

/* fecha de corte real de una persona: su fecha de baja si salió antes del
   corte pedido, si no, el corte mismo. La usan antigüedad y edad para que
   ninguna de las dos siga "contando" después de que la persona se fue. */
function corteEfectivo(r, hasta) {
  return r.fechaSalida && r.fechaSalida < hasta ? r.fechaSalida : hasta;
}

function antiguedadEnCorte(r, hasta) {
  return tenureYears(r.fechaIngreso, corteEfectivo(r, hasta));
}

/* edad en años cumplidos a una fecha — a diferencia de antigüedad (decimal),
   la edad se expresa en años enteros. */
function edadEnFecha(fechaNacimiento, fecha) {
  if (!fechaNacimiento) return null;
  const nac = new Date(fechaNacimiento + 'T00:00:00');
  const corte = new Date(fecha + 'T00:00:00');
  let edad = corte.getFullYear() - nac.getFullYear();
  const antesDeCumplir = corte.getMonth() < nac.getMonth() || (corte.getMonth() === nac.getMonth() && corte.getDate() < nac.getDate());
  if (antesDeCumplir) edad--;
  return edad;
}

function edadEnCorte(r, hasta) {
  return edadEnFecha(r.fechaNacimiento, corteEfectivo(r, hasta));
}

function poblacionEnRango(desde, hasta) {
  return historico()
    .all.filter((r) => enRango(r, desde, hasta))
    .map((r) => ({ ...r, antiguedad: antiguedadEnCorte(r, hasta), edad: edadEnCorte(r, hasta) }));
}

function isoFromDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* Los filtros de fecha son por mes (<input type="month">, valor "YYYY-MM").
   Internamente todo el cálculo sigue trabajando con fechas ISO completas
   ("YYYY-MM-DD"): desde = primer día del mes, hasta = último día del mes. */
function mesActual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function mesesAtras(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function inicioDeMes(mes) {
  return `${mes}-01`;
}

function finDeMes(mes) {
  const [y, m] = mes.split('-').map(Number);
  return isoFromDate(new Date(y, m, 0));
}

function monthsAgoIso(n) {
  return inicioDeMes(mesesAtras(n));
}

function monthsBetween(desde, hasta) {
  const start = new Date(desde + 'T00:00:00');
  const limit = new Date(hasta + 'T00:00:00');
  const months = [];
  let d = new Date(start.getFullYear(), start.getMonth(), 1);
  while (d <= limit) {
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    months.push({ label: d.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' }), start: isoFromDate(d), end: isoFromDate(next) });
    d = next;
  }
  return months;
}

function fmtMes(d) {
  return d ? new Date(d + 'T00:00:00').toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }) : 'el inicio registrado';
}

function fmtRango(desde, hasta) {
  return `${fmtMes(desde)} – ${fmtMes(hasta)}`;
}

function getRange(prefix) {
  const desdeMes = document.getElementById(`${prefix}-desde`)?.value || '';
  const hastaMes = document.getElementById(`${prefix}-hasta`)?.value || mesActual();
  return {
    desde: desdeMes ? inicioDeMes(desdeMes) : '',
    hasta: finDeMes(hastaMes),
  };
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
   estén en la lista (ej. si agregan un área nueva en la tabla) — se
   agregan al final en vez de desaparecer en silencio de las gráficas. */
function orderedKeys(present, order) {
  const known = order.filter((k) => present.has(k));
  const extra = [...present].filter((k) => !order.includes(k)).sort();
  return [...known, ...extra];
}

/* Una barra en 0 no se ve — solo deja una etiqueta de eje sin información,
   ruido puro para una vista que un directivo va a leer rápido. Se quita
   antes de graficar (solo aplica a categorías que pueden legítimamente
   valer 0, ej. conteos/tasas — no a promedios, donde 0 sí sería un dato real). */
function dropZeros(labels, values) {
  const kept = labels.map((_, i) => i).filter((i) => values[i] !== 0);
  return { labels: kept.map((i) => labels[i]), values: kept.map((i) => values[i]) };
}

/* Igual que dropZeros pero para varias series por categoría (ej. Hombre/Mujer
   por nivel): solo quita la categoría si TODAS las series valen 0 ahí, para
   no romper el apilado de una categoría con datos reales en solo una serie. */
function dropZerosMulti(labels, series) {
  const kept = labels.map((_, i) => i).filter((i) => series.some((s) => s[i] !== 0));
  return { labels: kept.map((i) => labels[i]), series: series.map((s) => kept.map((i) => s[i])) };
}

/* Sin hover no hay forma de ver el valor de cada rebanada de un doughnut —
   se dibuja el conteo y el % del total directo encima de la rebanada, en vez
   de en la leyenda. Plugin local (no global vía Chart.register) porque solo
   aplica a los dos doughnuts de este módulo. */
const donutValueLabels = {
  id: 'donutValueLabels',
  afterDatasetsDraw(chart) {
    const data = chart.data.datasets[0].data;
    const total = data.reduce((a, b) => a + b, 0);
    if (!total) return;
    const { ctx } = chart;
    ctx.save();
    ctx.font = '700 12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    chart.getDatasetMeta(0).data.forEach((arc, i) => {
      if (!data[i]) return;
      const pct = Math.round((data[i] / total) * 1000) / 10;
      const { x, y } = arc.getCenterPoint();
      ctx.fillText(`${data[i]} (${pct}%)`, x, y);
    });
    ctx.restore();
  },
};

/* Igual que donutValueLabels pero para segmentos de una barra apilada al
   100%: cada dataset trae `data` (el % que dibuja el alto del segmento) y
   `counts` (personas reales) por separado — el texto siempre muestra la
   persona real, no el %. Se salta segmentos angostos (<16px) donde el texto
   no cabría — mejor nada que un texto encimado con el de al lado. */
const stackedCountPctLabels = {
  id: 'stackedCountPctLabels',
  afterDatasetsDraw(chart) {
    const { datasets } = chart.data;
    const { ctx } = chart;
    ctx.save();
    ctx.font = '700 11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    datasets.forEach((ds, di) => {
      chart.getDatasetMeta(di).data.forEach((el, i) => {
        const count = ds.counts[i];
        if (!count) return;
        const { x, y, base } = el.getProps(['x', 'y', 'base'], true);
        if (Math.abs(base - y) < 16) return;
        ctx.fillText(`${count} (${ds.data[i]}%)`, x, (y + base) / 2);
      });
    });
    ctx.restore();
  },
};

/* ---- 1. ESTRUCTURA ORGANIZACIONAL ---- */
function renderEstructura() {
  const { desde, hasta } = getRange('estructura');
  const emp = poblacionEnRango(desde, hasta);
  document.getElementById('estructura-nota').textContent =
    `Filtros aplicados: activos en algún momento entre ${fmtRango(desde, hasta)}. n=${emp.length}.`;
  document.getElementById('estructura-stats').innerHTML = `
    <div class="stat-card" style="grid-column:1/-1"><div class="sq"></div><div class="label">Headcount en el rango</div><div class="value">${emp.length}</div><div class="sub">activos entre ${fmtRango(desde, hasta)}</div></div>
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
    data: { labels: niveles.map((n) => wrapLabel(n, 12)), datasets: [{ data: niveles.map((n) => byNivel[n].length), backgroundColor: '#4C4DF6', borderRadius: 5, maxBarThickness: 50 }] },
    options: {
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: { x: { ticks: { maxRotation: 0, minRotation: 0, autoSkip: false } }, y: { beginAtZero: true, ticks: { stepSize: 1 } } },
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
    options: {
      indexAxis: 'y',
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } }, y: { ticks: { autoSkip: false } } },
    },
  });
}

/* Bucket específico para "Distribución de antigüedad" — el primer año se
   parte en 0-3 y 4-11 meses (la ventana de mayor riesgo de salida temprana),
   luego un renglón por año exacto (1 al 5) y uno final para lo que pase de
   5, en vez de los rangos amplios de tenureBuckets() que usa Rotación. */
function antiguedadPorAnio(values) {
  const buckets = { '0-3 meses': 0, '4 meses-1 año': 0, '1 año': 0, '2 años': 0, '3 años': 0, '4 años': 0, '5 años': 0, '5+ años': 0 };
  values.forEach((y) => {
    if (y * 12 < 4) buckets['0-3 meses']++;
    else if (y < 1) buckets['4 meses-1 año']++;
    else if (y < 2) buckets['1 año']++;
    else if (y < 3) buckets['2 años']++;
    else if (y < 4) buckets['3 años']++;
    else if (y < 5) buckets['4 años']++;
    else if (y < 6) buckets['5 años']++;
    else buckets['5+ años']++;
  });
  return buckets;
}

/* ---- 2. ANTIGÜEDAD ---- */
function renderAntiguedad() {
  const { desde, hasta } = getRange('antiguedad');
  const emp = poblacionEnRango(desde, hasta).filter((e) => e.antiguedad !== null);
  const avgAntig = avg(emp.map((e) => e.antiguedad));
  const menos6m = emp.filter((e) => e.antiguedad < 0.5).length;
  document.getElementById('antiguedad-nota').textContent =
    `Antigüedad calculada al cierre de ${fmtMes(hasta)}, o a su fecha de baja si salió antes. Filtros aplicados: ${fmtRango(desde, hasta)}. n=${emp.length}.`;
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
    options: { plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { y: { beginAtZero: true } } },
  });

  const byNivel = groupBy(emp, (e) => e.nivel);
  const niveles = orderedKeys(new Set(Object.keys(byNivel)), NIVEL_ORDEN);
  if (chartAntigNivel) chartAntigNivel.destroy();
  chartAntigNivel = new Chart(document.getElementById('chart-antig-nivel'), {
    type: 'bar',
    data: { labels: niveles, datasets: [{ data: niveles.map((n) => Number(avg(byNivel[n].map((e) => e.antiguedad)).toFixed(1))), backgroundColor: '#4C4DF6', borderRadius: 5 }] },
    options: { plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { y: { beginAtZero: true } } },
  });

  const buckets = antiguedadPorAnio(emp.map((e) => e.antiguedad));
  const { labels: antigHistLabels, values: antigHistValues } = dropZeros(Object.keys(buckets), Object.values(buckets));
  if (chartAntigHist) chartAntigHist.destroy();
  chartAntigHist = new Chart(document.getElementById('chart-antig-hist'), {
    type: 'bar',
    data: { labels: antigHistLabels, datasets: [{ data: antigHistValues, backgroundColor: '#EE7D38', borderRadius: 5, maxBarThickness: 60 }] },
    options: { plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } },
  });
}

/* ---- 3. DEMOGRAFÍA ---- */
function renderDemografia() {
  const { desde, hasta } = getRange('demografia');
  const emp = poblacionEnRango(desde, hasta);

  document.getElementById('demografia-nota').textContent =
    `Calculado sobre activos entre ${fmtRango(desde, hasta)}. Edad calculada al cierre de ${fmtMes(hasta)} (o a la fecha de baja si salió antes). n=${emp.length}.`;

  const bySexo = groupBy(emp, (e) => e.sexo || 'Sin dato');
  const sexos = Object.keys(bySexo);
  if (chartSexo) chartSexo.destroy();
  chartSexo = new Chart(document.getElementById('chart-sexo'), {
    type: 'doughnut',
    plugins: [donutValueLabels],
    data: { labels: sexos, datasets: [{ data: sexos.map((s) => bySexo[s].length), backgroundColor: PALETTE }] },
    options: { plugins: { legend: { position: 'bottom' }, tooltip: { enabled: false } } },
  });

  const byNivel = groupBy(emp, (e) => e.nivel);
  const niveles = orderedKeys(new Set(Object.keys(byNivel)), NIVEL_ORDEN);
  const { labels: sexoNivelLabels, series: sexoNivelSeries } = dropZerosMulti(niveles, [
    niveles.map((n) => byNivel[n].filter((e) => e.sexo === 'Hombre').length),
    niveles.map((n) => byNivel[n].filter((e) => e.sexo === 'Mujer').length),
  ]);
  const sexoNivelTotales = sexoNivelLabels.map((_, i) => sexoNivelSeries[0][i] + sexoNivelSeries[1][i]);
  const sexoNivelPct = sexoNivelSeries.map((serie) => serie.map((v, i) => (sexoNivelTotales[i] ? Math.round((v / sexoNivelTotales[i]) * 1000) / 10 : 0)));
  if (chartSexoNivel) chartSexoNivel.destroy();
  chartSexoNivel = new Chart(document.getElementById('chart-sexo-nivel'), {
    type: 'bar',
    plugins: [stackedCountPctLabels],
    data: {
      labels: sexoNivelLabels,
      datasets: [
        { label: 'Hombre', data: sexoNivelPct[0], counts: sexoNivelSeries[0], backgroundColor: '#19199A', borderRadius: 4 },
        { label: 'Mujer', data: sexoNivelPct[1], counts: sexoNivelSeries[1], backgroundColor: '#EE7D38', borderRadius: 4 },
      ],
    },
    options: {
      plugins: { legend: { display: true, position: 'bottom' }, tooltip: { enabled: false }, valueLabels: false },
      scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, max: 100, ticks: { callback: (v) => v + '%' } } },
    },
  });

  const conEdad = emp.filter((e) => e.edad !== null);
  const edadBuckets = { '<20': 0, '20-25': 0, '25-30': 0, '30-35': 0, '35-40': 0, '40+': 0 };
  conEdad.forEach((e) => {
    if (e.edad < 20) edadBuckets['<20']++;
    else if (e.edad < 25) edadBuckets['20-25']++;
    else if (e.edad < 30) edadBuckets['25-30']++;
    else if (e.edad < 35) edadBuckets['30-35']++;
    else if (e.edad < 40) edadBuckets['35-40']++;
    else edadBuckets['40+']++;
  });
  const { labels: edadHistLabels, values: edadHistValues } = dropZeros(Object.keys(edadBuckets), Object.values(edadBuckets));
  if (chartEdadHist) chartEdadHist.destroy();
  chartEdadHist = new Chart(document.getElementById('chart-edad-hist'), {
    type: 'bar',
    data: { labels: edadHistLabels, datasets: [{ data: edadHistValues, backgroundColor: '#1E9E6B', borderRadius: 5, maxBarThickness: 60 }] },
    options: { plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } },
  });

  const byNivelEdad = groupBy(conEdad, (e) => e.nivel);
  const nivelesEdad = orderedKeys(new Set(Object.keys(byNivelEdad)), NIVEL_ORDEN);
  if (chartEdadNivel) chartEdadNivel.destroy();
  chartEdadNivel = new Chart(document.getElementById('chart-edad-nivel'), {
    type: 'bar',
    data: { labels: nivelesEdad, datasets: [{ data: nivelesEdad.map((n) => Number(avg(byNivelEdad[n].map((e) => e.edad)).toFixed(1))), backgroundColor: '#4C4DF6', borderRadius: 5 }] },
    options: { plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { y: { beginAtZero: true } } },
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
      plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } }, tooltip: { enabled: false } },
      scales: { x: { title: { display: true, text: 'Edad' } }, y: { title: { display: true, text: 'Antigüedad (años)' }, beginAtZero: true } },
    },
  });
}

/* ---- 4. RITMO DE CONTRATACIÓN ---- */
function renderContrataciones() {
  const { desde, hasta } = getRange('contrataciones');
  const desdeEfectivo = desde || monthsAgoIso(24);
  const { all } = historico();
  // altas = cualquiera con fecha de ingreso en el rango, siga activo o no (antes solo contaba activos hoy y perdía a quien entró y salió dentro de la ventana)
  const altas = all.filter((r) => r.fechaIngreso && r.fechaIngreso >= desdeEfectivo && r.fechaIngreso <= hasta);
  document.getElementById('contrataciones-nota').textContent =
    `Altas con fecha de ingreso entre ${fmtRango(desdeEfectivo, hasta)}. Filtros aplicados: ${fmtRango(desde, hasta)}. n=${altas.length}.`;

  const months = monthsBetween(desdeEfectivo, hasta);
  const altasDetallePorMes = months.map((m) => altas.filter((e) => e.fechaIngreso >= m.start && e.fechaIngreso < m.end));
  const altasPorMes = altasDetallePorMes.map((personas) => personas.length);
  if (chartAltasMes) chartAltasMes.destroy();
  chartAltasMes = new Chart(document.getElementById('chart-altas-mes'), {
    type: 'line',
    data: { labels: months.map((m) => m.label), datasets: [{ data: altasPorMes, borderColor: '#19199A', backgroundColor: 'rgba(25,25,154,0.08)', fill: true, tension: 0.3, pointRadius: 3 }] },
    options: {
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          callbacks: {
            title: (items) => `${items[0].label} — ${altasDetallePorMes[items[0].dataIndex].length} alta(s)`,
            label: (ctx) => {
              const personas = altasDetallePorMes[ctx.dataIndex];
              return personas.length ? personas.map((p) => `${p.nombre} — ${p.area}`) : 'Sin altas este mes';
            },
          },
        },
      },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
    },
  });

  const byArea = groupBy(altas, (e) => e.area);
  const areas = orderedKeys(new Set(Object.keys(byArea)), AREAS_ORDEN);
  if (chartAltasArea) chartAltasArea.destroy();
  chartAltasArea = new Chart(document.getElementById('chart-altas-area'), {
    type: 'bar',
    data: { labels: areas, datasets: [{ data: areas.map((a) => byArea[a].length), backgroundColor: '#EE7D38', borderRadius: 5 }] },
    options: { plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } },
  });

  // crecimiento neto = headcount reconstruido al final de cada mes (altas − bajas), no solo altas acumuladas
  const crecimiento = months.map((m) => headcountAt(m.end, all));
  if (chartCrecimientoAcumulado) chartCrecimientoAcumulado.destroy();
  chartCrecimientoAcumulado = new Chart(document.getElementById('chart-crecimiento-acumulado'), {
    type: 'line',
    data: { labels: months.map((m) => m.label), datasets: [{ data: crecimiento, borderColor: '#1E9E6B', backgroundColor: 'rgba(30,158,107,0.08)', fill: true, tension: 0.2, pointRadius: 0 }] },
    options: { plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { ticks: { maxTicksLimit: 12 } }, y: { beginAtZero: true } } },
  });
}

/* ---- ROTACIÓN ---- */
function renderRotacion() {
  const { desde, hasta } = getRange('rotacion');
  const desdeEfectivo = desde || monthsAgoIso(24);
  const { all, bajas } = historico();
  const months = monthsBetween(desdeEfectivo, hasta);
  const bajasRango = bajas.filter((b) => b.fecha >= desdeEfectivo && b.fecha <= hasta);

  const hcInicio = headcountAt(desdeEfectivo, all);
  const hcFin = headcountAt(hasta, all);
  const hcProm = (hcInicio + hcFin) / 2;
  const tasa = hcProm ? (bajasRango.length / hcProm) * 100 : null;

  const voluntarias = bajasRango.filter((b) => b.tipo === 'Voluntaria').length;
  const involuntarias = bajasRango.filter((b) => b.tipo === 'Involuntaria').length;
  const tasaVoluntaria = hcProm ? (voluntarias / hcProm) * 100 : null;
  const tasaInvoluntaria = hcProm ? (involuntarias / hcProm) * 100 : null;

  const conAntiguedad = bajasRango.filter((b) => b.fechaIngreso).map((b) => tenureYears(b.fechaIngreso, b.fecha));

  document.getElementById('rotacion-nota').textContent =
    `Tasa = bajas del periodo / headcount promedio del periodo (headcount al inicio + headcount al final, entre 2). Filtros aplicados: ${fmtRango(desdeEfectivo, hasta)}. n=${bajasRango.length} bajas.`;
  document.getElementById('rotacion-stats').innerHTML = `
    <div class="stat-card"><div class="sq"></div><div class="label">Rotación del periodo</div><div class="value">${tasa === null ? '—' : tasa.toFixed(1) + '%'}</div><div class="sub">${bajasRango.length} bajas / headcount prom. ${hcProm.toFixed(1)}</div></div>
    <div class="stat-card"><div class="sq"></div><div class="label">Rotación voluntaria</div><div class="value">${tasaVoluntaria === null ? '—' : tasaVoluntaria.toFixed(1) + '%'}</div><div class="sub">${voluntarias} bajas voluntarias</div></div>
    <div class="stat-card"><div class="sq"></div><div class="label">Rotación involuntaria</div><div class="value">${tasaInvoluntaria === null ? '—' : tasaInvoluntaria.toFixed(1) + '%'}</div><div class="sub">${involuntarias} bajas involuntarias</div></div>
  `;

  const bajasDetallePorMes = months.map((m) => bajasRango.filter((b) => b.fecha >= m.start && b.fecha < m.end));
  const hcPromPorMes = months.map((m) => (headcountAt(m.start, all) + headcountAt(m.end, all)) / 2);
  const tasaPorMes = months.map((m, i) => (hcPromPorMes[i] ? Number(((bajasDetallePorMes[i].length / hcPromPorMes[i]) * 100).toFixed(1)) : 0));
  if (chartRotacionMensual) chartRotacionMensual.destroy();
  chartRotacionMensual = new Chart(document.getElementById('chart-rotacion-mensual'), {
    type: 'line',
    data: { labels: months.map((m) => m.label), datasets: [{ data: tasaPorMes, borderColor: '#D64545', backgroundColor: 'rgba(214,69,69,0.08)', fill: true, tension: 0.3, pointRadius: 3 }] },
    options: {
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          callbacks: {
            title: (items) => `${items[0].label} — HC prom. ${hcPromPorMes[items[0].dataIndex].toFixed(1)}`,
            label: (ctx) => {
              const personas = bajasDetallePorMes[ctx.dataIndex];
              return personas.length ? personas.map((p) => `${p.nombre} — ${p.area}`) : 'Sin bajas este mes';
            },
          },
        },
        valueLabels: { suffix: '%' },
      },
      scales: { y: { beginAtZero: true, ticks: { callback: (v) => v + '%' } } },
    },
  });

  const areasAll = orderedKeys(new Set(all.map((r) => r.area)), AREAS_ORDEN);
  const rotacionAreaAll = areasAll.map((a) => {
    const bajasArea = bajasRango.filter((b) => b.area === a).length;
    const prom = (headcountAt(desdeEfectivo, all, (r) => r.area === a) + headcountAt(hasta, all, (r) => r.area === a)) / 2;
    return prom ? Number(((bajasArea / prom) * 100).toFixed(1)) : 0;
  });
  const { labels: rotacionAreaLabels, values: rotacionAreaValues } = dropZeros(areasAll.map(wrapLabel), rotacionAreaAll);
  if (chartRotacionArea) chartRotacionArea.destroy();
  chartRotacionArea = new Chart(document.getElementById('chart-rotacion-area'), {
    type: 'bar',
    data: { labels: rotacionAreaLabels, datasets: [{ data: rotacionAreaValues, backgroundColor: '#D64545', borderRadius: 5 }] },
    options: {
      plugins: { legend: { display: false }, tooltip: { enabled: false }, valueLabels: { suffix: '%' } },
      scales: { x: { ticks: { maxRotation: 0, minRotation: 0, autoSkip: false } }, y: { beginAtZero: true, ticks: { callback: (v) => v + '%' } } },
    },
  });

  if (chartTipoBaja) chartTipoBaja.destroy();
  chartTipoBaja = new Chart(document.getElementById('chart-tipo-baja'), {
    type: 'doughnut',
    plugins: [donutValueLabels],
    data: { labels: ['Voluntaria', 'Involuntaria'], datasets: [{ data: [voluntarias, involuntarias], backgroundColor: ['#19199A', '#D64545'] }] },
    options: { plugins: { legend: { position: 'bottom' }, tooltip: { enabled: false } } },
  });

  const conMotivo = bajasRango.filter((b) => b.motivo && b.motivo.toUpperCase() !== 'NA');
  const sinMotivo = bajasRango.length - conMotivo.length;
  const byMotivo = groupBy(conMotivo, (b) => b.motivo);
  const motivosOrdenados = Object.entries(byMotivo).sort((a, b) => b[1].length - a[1].length);
  if (chartMotivos) chartMotivos.destroy();
  chartMotivos = new Chart(document.getElementById('chart-motivos'), {
    type: 'bar',
    data: { labels: motivosOrdenados.map(([m]) => wrapLabel(m, 22)), datasets: [{ data: motivosOrdenados.map(([, v]) => v.length), backgroundColor: '#4C4DF6', borderRadius: 5 }] },
    options: { indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } } },
  });
  document.getElementById('rotacion-motivos-nota').textContent = sinMotivo
    ? `${sinMotivo} baja(s) sin motivo registrado en la tabla (excluidas de la gráfica de motivos).`
    : '';

  const buckets = tenureBuckets(conAntiguedad);
  const { labels: antigBajaLabels, values: antigBajaValues } = dropZeros(Object.keys(buckets), Object.values(buckets));
  if (chartAntiguedadBaja) chartAntiguedadBaja.destroy();
  chartAntiguedadBaja = new Chart(document.getElementById('chart-antiguedad-baja'), {
    type: 'bar',
    data: { labels: antigBajaLabels, datasets: [{ data: antigBajaValues, backgroundColor: '#E0A61A', borderRadius: 5, maxBarThickness: 60 }] },
    options: { plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } },
  });

  const byNivel = groupBy(bajasRango, (b) => b.nivel);
  const nivelesTabla = orderedKeys(new Set(Object.keys(byNivel)), NIVEL_ORDEN);
  const tbodyNivel = document.querySelector('#rotacion-nivel-table tbody');
  tbodyNivel.innerHTML = nivelesTabla.length
    ? nivelesTabla.map((n) => `<tr><td><strong>${n}</strong></td><td>${byNivel[n].length}</td></tr>`).join('')
    : `<tr><td colspan="2" class="empty">Sin bajas registradas con fecha en este rango.</td></tr>`;
}

/* ---- 5. CALIDAD DE DATOS ---- */
function renderCalidad() {
  const emp = activos();
  const dq = appData.dataQuality || { excluidos: 0, incompletos: [] };
  document.getElementById('calidad-nota').textContent =
    `${dq.excluidos} registro(s) con Estatus = Activo se excluyeron del análisis por venir sin Nombre Completo (filas de plantilla vacías de la tabla).`;

  const pct = emp.length ? Math.round((dq.incompletos.length / emp.length) * 100) : 0;
  document.getElementById('calidad-stats').innerHTML = `
    <div class="stat-card"><div class="sq"></div><div class="label">Registros incompletos</div><div class="value" style="color:${pct ? 'var(--amarillo)' : 'var(--verde)'}">${dq.incompletos.length}</div><div class="sub">${pct}% de la plantilla activa</div></div>
    <div class="stat-card"><div class="sq"></div><div class="label">Registros excluidos</div><div class="value">${dq.excluidos}</div><div class="sub">sin Nombre Completo en la tabla</div></div>
  `;

  const tbody = document.querySelector('#calidad-table tbody');
  tbody.innerHTML = dq.incompletos.length
    ? dq.incompletos.map((r) => `<tr><td><strong>${r.nombre || r.id}</strong></td><td>${r.campos.join(', ')}</td></tr>`).join('')
    : `<tr><td colspan="2" class="empty">Sin registros con datos incompletos.</td></tr>`;
}

/* ---- 6. CRUCES ESTRATÉGICOS ---- */
function renderCruces() {
  const { desde, hasta } = getRange('cruces');
  const emp = poblacionEnRango(desde, hasta);
  document.getElementById('cruces-nota').textContent =
    `Señales calculadas sobre activos entre ${fmtRango(desde, hasta)}. n=${emp.length}.`;
  const lideres = emp.filter((e) => LIDERES.has(e.nivel)).length;
  const resto = emp.length - lideres;
  if (chartLideres) chartLideres.destroy();
  chartLideres = new Chart(document.getElementById('chart-lideres'), {
    type: 'bar',
    data: { labels: ['Líderes (Manager/Jr Manager/Executive)', 'Colaboradores'], datasets: [{ data: [lideres, resto], backgroundColor: ['#19199A', '#E8E7E7'], borderRadius: 5 }] },
    options: { indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } } },
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

/* ---- 7. BASE DE DATOS (editable, escribe directo a BigQuery) ---- */
function normalizeText(s) {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

function renderBaseDatos() {
  const estatus = document.getElementById('basedatos-estatus').value;
  const q = normalizeText(document.getElementById('basedatos-search').value);
  const rows = (appData.empleadosTabla || [])
    .filter((e) => !estatus || e.estatus === estatus)
    .filter((e) => !q || normalizeText(e.nombre).includes(q))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const tbody = document.querySelector('#basedatos-table tbody');
  tbody.innerHTML = rows.length
    ? rows
        .map(
          (e) => `<tr>
        <td><strong>${e.nombre}</strong></td>
        <td>${e.puesto || '—'}</td>
        <td>${e.nivelPuesto || '—'}</td>
        <td>${e.area || '—'}</td>
        <td><span class="badge ${e.estatus === 'Activo' ? 'ok' : 'bad'}">${e.estatus}</span></td>
        <td>${e.reportsToName || '—'}</td>
        <td>${canEdit() ? `<button class="btn small secondary" data-editempleado="${e.id}">Editar</button>` : ''}</td>
      </tr>`,
        )
        .join('')
    : `<tr><td colspan="7" class="empty">Sin registros con esos filtros.</td></tr>`;

  tbody.querySelectorAll('[data-editempleado]').forEach((btn) => {
    btn.addEventListener('click', () => openEmpleadoModal(btn.dataset.editempleado));
  });
}

document.getElementById('basedatos-estatus').addEventListener('change', renderBaseDatos);
document.getElementById('basedatos-search').addEventListener('input', renderBaseDatos);

function fillMeReportsToSelect(currentName) {
  const sel = document.getElementById('me-reportsto');
  const opts = appData.empleados
    .slice()
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .map((e) => `<option value="${e.nombre}">${e.nombre}</option>`)
    .join('');
  sel.innerHTML = `<option value="">Nadie (nivel superior)</option>` + opts;
  sel.value = currentName || '';
}

function openEmpleadoModal(id) {
  const e = (appData.empleadosTabla || []).find((x) => x.id === id);
  if (!e) return;
  document.getElementById('me-title').textContent = e.nombre;
  document.getElementById('me-id').value = e.id;
  document.getElementById('me-nombre').value = e.nombre || '';
  document.getElementById('me-correo').value = e.correo || '';
  document.getElementById('me-puesto').value = e.puesto || '';
  document.getElementById('me-nivel').value = e.nivelPuesto || '';
  document.getElementById('me-area').value = e.area || '';
  fillMeReportsToSelect(e.reportsToName);
  document.getElementById('me-sexo').value = e.sexo || '';
  document.getElementById('me-edad').value = e.edad ?? '';
  document.getElementById('me-fechanacimiento').value = e.fechaNacimiento || '';
  document.getElementById('me-fechaingreso').value = e.fechaIngreso || '';
  document.getElementById('me-estatus').value = e.estatus || 'Activo';
  document.getElementById('me-fechabaja').value = e.fechaBaja || '';
  document.getElementById('me-tipobaja').value = e.tipoBaja || '';
  document.getElementById('me-motivobaja').value = e.motivoBaja || '';
  openModal('modal-empleado');
}

document.getElementById('me-save').addEventListener('click', async () => {
  if (!canEdit()) return;
  const id = document.getElementById('me-id').value;
  const payload = {
    nombre: document.getElementById('me-nombre').value.trim(),
    correo: document.getElementById('me-correo').value.trim(),
    puesto: document.getElementById('me-puesto').value.trim(),
    nivelPuesto: document.getElementById('me-nivel').value.trim(),
    area: document.getElementById('me-area').value.trim(),
    reportsToName: document.getElementById('me-reportsto').value,
    sexo: document.getElementById('me-sexo').value.trim(),
    edad: document.getElementById('me-edad').value,
    fechaNacimiento: document.getElementById('me-fechanacimiento').value,
    fechaIngreso: document.getElementById('me-fechaingreso').value,
    estatus: document.getElementById('me-estatus').value,
    fechaBaja: document.getElementById('me-fechabaja').value,
    tipoBaja: document.getElementById('me-tipobaja').value,
    motivoBaja: document.getElementById('me-motivobaja').value.trim(),
  };
  if (!payload.nombre) {
    showToast('El nombre no puede quedar vacío');
    return;
  }
  if (!(await updateEmpleadoRemoto(id, payload))) return;
  closeModal('modal-empleado');
  renderBaseDatos();
  showToast('Empleado actualizado en BigQuery');
});
