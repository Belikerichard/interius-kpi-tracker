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
  const empleadosTabla = []; // vista completa (Activo + Inactivo, todas las columnas) para editar desde la app — ver updateEmpleado()

  for (const r of clean) {
    const id = r['INTERIUS ID'];
    const nombre = collapseSpaces(r['Nombre Completo']);
    const puesto = correctPuesto(r['Puesto Completo']);
    const area = collapseSpaces(r['Area']) || 'Sin área';
    const fechaIngreso = toIsoDate(r['Fecha de Contratación']);
    const fechaNacimiento = toIsoDate(r['Fecha de Nacimiento']);
    const nivelPuestoRaw = collapseSpaces(r['Nivel de Puesto']);
    const edadNum = Number(r['Edad']);
    const activo = r['Estatus'] === 'Activo';

    empleadosTabla.push({
      id,
      nombre,
      puesto,
      nivelPuesto: NIVEL_INDEFINIDO.has(nivelPuestoRaw) ? '' : nivelPuestoRaw,
      area: collapseSpaces(r['Area']),
      sexo: r['Sexo'] || '',
      edad: Number.isFinite(edadNum) ? edadNum : '',
      fechaNacimiento,
      fechaIngreso,
      estatus: activo ? 'Activo' : 'Inactivo',
      correo: (r['Correo'] || '').toLowerCase(),
      reportsToName: collapseSpaces(r['Reporta a:']),
      tipoBaja: activo ? '' : r['Tipo de Baja'] === 'Involuntaria' ? 'Involuntaria' : 'Voluntaria',
      motivoBaja: activo ? '' : r['Motivo de Baja'] || '',
      fechaBaja: activo ? null : toIsoDate(r['Fecha de Baja']),
    });

    if (activo) {
      const nivelPuesto = NIVEL_INDEFINIDO.has(nivelPuestoRaw) ? null : nivelPuestoRaw;
      const edad = Number.isFinite(edadNum) ? edadNum : null;

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
        edad,
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
  return { personas, empleados, bajas, dataQuality: { excluidos, incompletos }, empleadosTabla };
}

/* Columna real de BigQuery (con espacios/acentos) por cada campo editable
   desde la app. `INTERIUS ID` nunca se edita — es la llave del UPDATE. */
const COLUMN_BY_FIELD = {
  nombre: 'Nombre Completo',
  puesto: 'Puesto Completo',
  nivelPuesto: 'Nivel de Puesto',
  area: 'Area',
  reportsToName: 'Reporta a:',
  sexo: 'Sexo',
  fechaNacimiento: 'Fecha de Nacimiento',
  fechaIngreso: 'Fecha de Contratación',
  estatus: 'Estatus',
  correo: 'Correo',
  tipoBaja: 'Tipo de Baja',
  motivoBaja: 'Motivo de Baja',
  fechaBaja: 'Fecha de Baja',
};

function fromIsoDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${Number(m)}/${Number(d)}/${y}`;
}

/* UPDATE por INTERIUS ID. Requiere que el service account tenga
   BigQuery Data Editor en el dataset (además del Data Viewer / Job User
   que ya usa la lectura) — sin eso esto tira permission denied.
   `edad` se manda solo si viene con un número válido: no conocemos el tipo
   real de esa columna (INT64 vs STRING) y un valor ambiguo (null/'') podría
   no inferir tipo correctamente; el resto son columnas de texto/fecha en
   la tabla (confirmado por cómo ya se leen) así que un string vacío es
   seguro para "borrar" el valor. */
export async function updateEmpleado(table, id, fields) {
  const sets = [];
  const params = { id: String(id) };
  for (const [field, column] of Object.entries(COLUMN_BY_FIELD)) {
    if (!(field in fields)) continue;
    const paramName = `f_${field}`;
    const raw = fields[field];
    const value = ['fechaNacimiento', 'fechaIngreso', 'fechaBaja'].includes(field) ? fromIsoDate(raw) : (raw ?? '').toString();
    sets.push(`\`${column}\` = @${paramName}`);
    params[paramName] = value;
  }
  if ('edad' in fields) {
    const edad = Number(fields.edad);
    if (Number.isFinite(edad)) {
      sets.push('`Edad` = @f_edad');
      params.f_edad = edad;
    }
  }
  if (!sets.length) return;
  // CAST a STRING porque no conocemos si INTERIUS ID es STRING o numérico en la tabla real.
  const query = `UPDATE \`${table}\` SET ${sets.join(', ')} WHERE CAST(\`INTERIUS ID\` AS STRING) = @id`;
  await client().query({ query, params });
}
