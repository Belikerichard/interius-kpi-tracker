/* Lee la tabla de empleados desde BigQuery (antes era un Google Sheet
   público vía CSV, ver historial de bigquery.js/sheets.js). Autenticado con
   un service account cuya key vive en GOOGLE_SERVICE_ACCOUNT_JSON (.env en
   local, variable de entorno en Vercel — nunca en el repo). Deriva de ahí
   personas (equipo/organigrama), empleados (antigüedad) y bajas: son la
   misma fuente, la tabla no tiene una fila por vista. */
import { BigQuery } from '@google-cloud/bigquery';

let bigquery;
function client() {
  if (!bigquery) bigquery = new BigQuery({ credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON) });
  return bigquery;
}

async function fetchEmpleadosTable(table) {
  const [rows] = await client().query({ query: `SELECT * FROM \`${table}\`` });
  return rows;
}

/* M/D/YYYY -> YYYY-MM-DD. La tabla usa 12/31/9999 como sentinela de
   "sin fecha" (empleados activos no tienen fecha de baja) -> null. */
function toIsoDate(mdy) {
  const m = (mdy || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, mo, d, y] = m;
  if (y === '9999') return null;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/* La tabla no siempre acentúa igual el mismo nombre en su propia fila y en
   "Reporta a:" de quien le reporta (ej. "Sofia Elizondo Marquez" vs "Sofía
   Elizondo Márquez") — se normaliza (sin acentos, minúsculas, sin espacios
   extra) solo para emparejar, nunca para lo que se muestra. */
function normalizeName(name) {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

function collapseSpaces(s) {
  return (s || '').replace(/\s+/g, ' ').trim();
}

/* La tabla trae typos ocasionales en "Puesto Completo" que rompen cualquier
   agrupación/derivación por puesto. Diccionario chico, extensible. */
const PUESTO_FIXES = {
  'Inbound Marketing Specialit': 'Inbound Marketing Specialist',
  'Full Stack Debeloper Trainee': 'Full Stack Developer Trainee',
};

function correctPuesto(puesto) {
  const clean = collapseSpaces(puesto);
  return PUESTO_FIXES[clean] || clean;
}

const NIVEL_INDEFINIDO = new Set(['', 'Por Definir']);

export async function loadEmpleadosFromBigQuery(table) {
  const rows = await fetchEmpleadosTable(table);
  const clean = rows.filter((r) => r['Nombre Completo']); // descarta filas en blanco/de relleno
  const excluidos = rows.filter((r) => !r['Nombre Completo'] && r['Estatus'] === 'Activo').length;
  const nameToId = new Map(clean.map((r) => [normalizeName(r['Nombre Completo']), r['INTERIUS ID']]));

  const personas = [];
  const empleados = [];
  const bajas = [];
  const incompletos = [];

  for (const r of clean) {
    const id = r['INTERIUS ID'];
    const nombre = collapseSpaces(r['Nombre Completo']);
    const puesto = correctPuesto(r['Puesto Completo']);
    const area = collapseSpaces(r['Area']) || 'Sin área';
    const fechaIngreso = toIsoDate(r['Fecha de Contratación']);
    const fechaNacimiento = toIsoDate(r['Fecha de Nacimiento']);

    if (r['Estatus'] === 'Activo') {
      const nivelPuestoRaw = collapseSpaces(r['Nivel de Puesto']);
      const nivelPuesto = NIVEL_INDEFINIDO.has(nivelPuestoRaw) ? null : nivelPuestoRaw;
      const edad = r['Edad'] ? Number(r['Edad']) : null;

      personas.push({
        id,
        name: nombre,
        rol: puesto,
        reportsTo: nameToId.get(normalizeName(r['Reporta a:'] || '')) || null,
        email: (r['Correo'] || '').toLowerCase(),
      });
      empleados.push({
        id,
        nombre,
        area,
        rol: puesto,
        nivelPuesto,
        sexo: r['Sexo'] || null,
        edad: Number.isFinite(edad) ? edad : null,
        fechaNacimiento,
        fechaIngreso,
        fechaPuesto: fechaIngreso, // la tabla no registra fecha de cambio de puesto
        reportsTo: nameToId.get(normalizeName(r['Reporta a:'] || '')) || null,
      });

      const camposFaltantes = [
        !nivelPuesto && 'Nivel de Puesto',
        !edad && 'Edad',
        !puesto && 'Puesto',
        area === 'Sin área' && 'Área',
        !fechaIngreso && 'Fecha de Contratación',
      ].filter(Boolean);
      if (camposFaltantes.length) incompletos.push({ id, nombre, campos: camposFaltantes });
    } else {
      const fecha = toIsoDate(r['Fecha de Baja']);
      if (fecha) {
        const nivelPuestoRaw = collapseSpaces(r['Nivel de Puesto']);
        bajas.push({
          id: `baja-${id}`,
          empleado: nombre,
          area,
          nivelPuesto: NIVEL_INDEFINIDO.has(nivelPuestoRaw) ? null : nivelPuestoRaw,
          sexo: r['Sexo'] || null,
          reportsTo: nameToId.get(normalizeName(r['Reporta a:'] || '')) || null,
          fecha,
          fechaNacimiento,
          fechaIngreso, // para reconstruir headcount/estructura histórica (filtro de fechas de People Analytics)
          tipo: r['Tipo de Baja'] === 'Involuntaria' ? 'Involuntaria' : 'Voluntaria',
          motivo: r['Motivo de Baja'] || '',
        });
      }
    }
  }
  return { personas, empleados, bajas, dataQuality: { excluidos, incompletos } };
}
