/* Servidor Express: sirve la app estática y persiste appData en el servidor
   (data/store.json) en vez de localStorage. Mismo contrato que antes: el
   cliente pide el blob completo y lo vuelve a mandar completo al guardar.
   Equipo, antigüedad y bajas ya no viven en /data: se leen en vivo de la
   tabla de BigQuery configurada en config.json (ver bigquery.js).
   data/personas.json quedó solo como el control de acceso — qué correo
   tiene qué rol de login — porque esa asignación no existe en la tabla y
   no se debe mezclar ahí.

   Todo /api/* requiere un ID token de Google verificado (Authorization:
   Bearer <token>) — antes esto lo filtraba solo la UI en el navegador, así
   que cualquiera con la URL podía leer o sobreescribir todo el estado (y
   /data/*.json se servía tal cual por express.static). Ver README para el
   detalle de qué endpoint pide qué rol. */
import express from 'express';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OAuth2Client } from 'google-auth-library';
import { loadEmpleadosFromBigQuery, updateEmpleado } from './bigquery.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

async function readJson(file) {
  return JSON.parse(await readFile(path.join(DATA_DIR, file), 'utf8'));
}

async function readStore() {
  try {
    return JSON.parse(await readFile(STORE_PATH, 'utf8'));
  } catch {
    return null;
  }
}

async function loadPersonasLive(config) {
  const [{ personas, empleados, bajas, dataQuality, empleadosTabla }, access] = await Promise.all([
    loadEmpleadosFromBigQuery(config.bigqueryTable),
    readJson('personas.json'),
  ]);
  const roleByEmail = new Map(access.map((a) => [a.email.toLowerCase(), a.role]));
  return { personas: personas.map((p) => ({ ...p, role: roleByEmail.get(p.email) })), empleados, bajas, dataQuality, empleadosTabla };
}

async function loadSourceTables() {
  const [clientes, kpis, headcount, config] = await Promise.all([
    readJson('clientes.json'),
    readJson('kpis.json'),
    readJson('headcount.json'),
    readJson('config.json'),
  ]);
  const { personas, empleados, bajas, dataQuality, empleadosTabla } = await loadPersonasLive(config);
  return {
    clientes,
    personas,
    kpis,
    headcount,
    bajas,
    empleados,
    dataQuality,
    empleadosTabla,
    rotacionMeta: config.rotacionMeta,
    googleClientId: config.googleClientId,
  };
}

const app = express();
app.use(express.json({ limit: '10mb' }));

// ponytail: express.static(__dirname) serviría /data/*.json (y server.js,
// package.json...) tal cual a cualquiera, sin pasar por el auth de abajo —
// solo se exponen las carpetas realmente públicas, nunca /data.
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// googleClientId es público por diseño (va embebido en el JS del navegador
// para el botón de login) — este endpoint no requiere auth a propósito,
// es lo único que hace falta antes de que exista una sesión.
app.get('/api/config', async (req, res) => {
  const config = await readJson('config.json');
  res.json({ googleClientId: config.googleClientId });
});

const oauthClient = new OAuth2Client();

async function verifyGoogleToken(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new Error('falta token');
  const config = await readJson('config.json');
  const ticket = await oauthClient.verifyIdToken({ idToken: token, audience: config.googleClientId });
  return (ticket.getPayload().email || '').toLowerCase();
}

// Personas desde el cache si ya existe (evita pegarle a BigQuery en cada
// request autenticado); si no hay cache todavía, las compone en vivo.
async function currentPersonas() {
  const stored = await readStore();
  if (stored?.personas) return stored.personas;
  const config = await readJson('config.json');
  return (await loadPersonasLive(config)).personas;
}

async function requireAuth(req, res, next) {
  try {
    const email = await verifyGoogleToken(req);
    const persona = (await currentPersonas()).find((p) => p.email && p.email.toLowerCase() === email && p.role);
    if (!persona) return res.status(403).json({ error: 'Ese correo no tiene acceso.' });
    req.auth = { email, role: persona.role, personaId: persona.id };
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o vencido, vuelve a iniciar sesión.' });
  }
}

function requireSuperAdmin(req, res, next) {
  if (req.auth.role !== 'super_admin') return res.status(403).json({ error: 'Tu rol no puede guardar cambios.' });
  next();
}

/* People Analytics (empleados/bajas/dataQuality/headcount) es exclusivo de
   super_admin (ver canViewPeopleAnalytics en permissions.js) y 'usuario'
   solo debe ver lo propio (mismo recorte que visibleX en permissions.js) —
   duplicado aquí a propósito: el cliente no es de fiar para aplicar este
   filtro, tiene que hacerlo quien sirve los datos. */
function scopeDataForRole(data, auth) {
  if (auth.role === 'super_admin') return data;
  const { empleados, bajas, dataQuality, headcount, empleadosTabla, ...rest } = data;
  if (auth.role === 'admin') return rest;
  const kpis = rest.kpis.filter((k) => k.personaId === auth.personaId);
  const clienteIds = new Set(kpis.map((k) => k.clienteId));
  return {
    ...rest,
    personas: rest.personas.filter((p) => p.id === auth.personaId),
    kpis,
    clientes: rest.clientes.filter((c) => clienteIds.has(c.id)),
  };
}

// ponytail: en Vercel el filesystem del deploy es de solo lectura (fuera de
// /tmp) — el caché a disco es best-effort; si falla, cada request recompone
// desde BigQuery en vez de tronar. Local (npm start) no cambia: sigue
// cacheando a data/store.json como antes. Nota aparte: en Vercel cada
// instancia serverless tiene su propio /tmp, así que bajo tráfico
// concurrente dos requests pueden ver caches divergentes hasta que ambas
// recomponen desde BigQuery — aceptable para el uso actual (esporádico/
// pocos admins), no para edición simultánea a gran escala.
async function cacheStore(data) {
  try {
    await writeFile(STORE_PATH, JSON.stringify(data));
  } catch {
    /* solo lectura (serverless) — sin caché, próxima request recompone */
  }
}

async function composeAndCache(baseRev) {
  const data = await loadSourceTables();
  data._rev = baseRev + 1;
  await cacheStore(data);
  return data;
}

app.get('/api/data', requireAuth, async (req, res) => {
  const data = (await readStore()) || (await composeAndCache(0));
  res.json(scopeDataForRole(data, req.auth));
});

// Versionado optimista: cada blob guardado trae un _rev. Si el POST no
// parte de la revisión actual, alguien más ya guardó encima — se rechaza
// en vez de pisar ese cambio en silencio (antes era last-write-wins).
app.post('/api/data', requireAuth, requireSuperAdmin, async (req, res) => {
  const current = await readStore();
  const currentRev = current?._rev || 0;
  if ((req.body._rev || 0) !== currentRev) {
    return res.status(409).json({ error: 'Alguien más guardó cambios primero. Se recargaron los datos más recientes.', data: current });
  }
  const data = { ...req.body, _rev: currentRev + 1 };
  await cacheStore(data);
  res.json({ ok: true, _rev: data._rev });
});

app.post('/api/data/restore', requireAuth, requireSuperAdmin, async (req, res) => {
  const data = await composeAndCache((await readStore())?._rev || 0);
  res.json(data);
});

/* Edita un empleado directamente en la tabla de BigQuery (UPDATE por
   INTERIUS ID, ver bigquery.js) y luego recompone personas/empleados/
   bajas/dataQuality/empleadosTabla desde ahí para que el cache quede al
   día. El service account necesita rol BigQuery Data Editor además del
   Data Viewer que ya usa la lectura — sin eso esto responde 502. */
app.post('/api/empleados/:id', requireAuth, requireSuperAdmin, async (req, res) => {
  const config = await readJson('config.json');
  try {
    await updateEmpleado(config.bigqueryTable, req.params.id, req.body);
  } catch (e) {
    console.error('BigQuery update falló', e);
    return res.status(502).json({ error: `No se pudo guardar en BigQuery: ${e.message || e}` });
  }
  const current = await readStore();
  const base = current || (await loadSourceTables());
  const { personas, empleados, bajas, dataQuality, empleadosTabla } = await loadPersonasLive(config);
  const data = { ...base, personas, empleados, bajas, dataQuality, empleadosTabla, _rev: (current?._rev || 0) + 1 };
  await cacheStore(data);
  res.json(scopeDataForRole(data, req.auth));
});

/* Refresca solo personas (equipo + accesos) desde BigQuery y actualiza el
   cache del servidor directamente — usado cuando alguien nuevo recibe
   acceso y su navegador todavía tiene el store.json viejo cacheado. Solo
   exige un token de Google válido (no un rol ya conocido): ese es
   justamente el caso que resuelve. */
app.get('/api/personas', async (req, res) => {
  await verifyGoogleToken(req); // Express 5 reenvía el rechazo a la error-middleware de abajo
  const config = await readJson('config.json');
  const { personas } = await loadPersonasLive(config);
  const stored = await readStore();
  if (stored) {
    stored.personas = personas;
    stored._rev = (stored._rev || 0) + 1;
    await cacheStore(stored);
  }
  res.json(personas);
});

app.use((err, req, res, next) => {
  res.status(err.status || 401).json({ error: 'Token inválido o vencido, vuelve a iniciar sesión.' });
});

const PORT = process.env.PORT || 3000;
// ponytail: en Vercel este archivo se importa como función serverless (ver
// vercel.json) — ahí no se llama listen(), Vercel maneja el socket.
if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
}

export default app;
