/* Lee la pestaña "DB Empleados" de un Google Sheet público ("Cualquiera con
   el enlace puede ver") vía su export CSV — sin API key ni service account.
   Deriva de ahí personas (equipo/organigrama), empleados (antigüedad) y
   bajas: son la misma fuente, el Sheet no tiene una tabla por vista. */

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function csvToObjects(text) {
  const [header, ...body] = parseCsv(text).filter((r) => r.some((cell) => cell !== ''));
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

async function fetchSheetTab(sheetId, tabName) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `No se pudo leer la pestaña "${tabName}" del Google Sheet (HTTP ${res.status}). ¿Sigue compartido como "Cualquiera con el enlace puede ver"?`,
    );
  }
  return csvToObjects(await res.text());
}

/* M/D/YYYY -> YYYY-MM-DD. El Sheet usa 12/31/9999 como sentinela de
   "sin fecha" (empleados activos no tienen fecha de baja) -> null. */
function toIsoDate(mdy) {
  const m = (mdy || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, mo, d, y] = m;
  if (y === '9999') return null;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/* El Sheet no siempre acentúa igual el mismo nombre en su propia fila y en
   "Reporta a:" de quien le reporta (ej. "Sofia Elizondo Marquez" vs "Sofía
   Elizondo Márquez") — se normaliza (sin acentos, minúsculas, sin espacios
   extra) solo para emparejar, nunca para lo que se muestra. */
function normalizeName(name) {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

function collapseSpaces(s) {
  return (s || '').replace(/\s+/g, ' ').trim();
}

/* El Sheet trae typos ocasionales en "Puesto Completo" que rompen cualquier
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

export async function loadEmpleadosFromSheet(sheetId) {
  const rows = await fetchSheetTab(sheetId, 'DB Empleados');
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
        fechaIngreso,
        fechaPuesto: fechaIngreso, // el Sheet no registra fecha de cambio de puesto
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
          fecha,
          fechaIngreso, // para reconstruir headcount histórico si hiciera falta
          tipo: r['Tipo de Baja'] === 'Involuntaria' ? 'Involuntaria' : 'Voluntaria',
          motivo: r['Motivo de Baja'] || '',
        });
      }
    }
  }
  return { personas, empleados, bajas, dataQuality: { excluidos, incompletos } };
}
