/* Servidor Express: sirve la app estática y persiste appData en el servidor
   (data/store.json) en vez de localStorage. Mismo contrato que antes: el
   cliente pide el blob completo y lo vuelve a mandar completo al guardar.
   Equipo, antigüedad y bajas ya no viven en /data: se leen en vivo de la
   tabla de BigQuery configurada en config.json (ver bigquery.js).
   data/personas.json quedó solo como el control de acceso — qué correo
   tiene qué rol de login — porque esa asignación no existe en la tabla y
   no se debe mezclar ahí. */
import express from 'express';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEmpleadosFromBigQuery } from './bigquery.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

async function readJson(file) {
  return JSON.parse(await readFile(path.join(DATA_DIR, file), 'utf8'));
}

async function loadPersonasLive(config) {
  const [{ personas, empleados, bajas, dataQuality }, access] = await Promise.all([
    loadEmpleadosFromBigQuery(config.bigqueryTable),
    readJson('personas.json'),
  ]);
  const roleByEmail = new Map(access.map((a) => [a.email.toLowerCase(), a.role]));
  return { personas: personas.map((p) => ({ ...p, role: roleByEmail.get(p.email) })), empleados, bajas, dataQuality };
}

async function loadSourceTables() {
  const [clientes, kpis, headcount, config] = await Promise.all([
    readJson('clientes.json'),
    readJson('kpis.json'),
    readJson('headcount.json'),
    readJson('config.json'),
  ]);
  const { personas, empleados, bajas, dataQuality } = await loadPersonasLive(config);
  return {
    clientes,
    personas,
    kpis,
    headcount,
    bajas,
    empleados,
    dataQuality,
    rotacionMeta: config.rotacionMeta,
    googleClientId: config.googleClientId,
  };
}

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// ponytail: en Vercel el filesystem del deploy es de solo lectura (fuera de
// /tmp) — el caché a disco es best-effort; si falla, cada request recompone
// desde BigQuery en vez de tronar. Local (npm start) no cambia: sigue
// cacheando a data/store.json como antes.
async function cacheStore(data) {
  try {
    await writeFile(STORE_PATH, JSON.stringify(data));
  } catch {
    /* solo lectura (serverless) — sin caché, próxima request recompone */
  }
}

app.get('/api/data', async (req, res) => {
  try {
    res.json(JSON.parse(await readFile(STORE_PATH, 'utf8')));
  } catch {
    const data = await loadSourceTables();
    await cacheStore(data);
    res.json(data);
  }
});

app.post('/api/data', async (req, res) => {
  await cacheStore(req.body);
  res.json({ ok: true });
});

app.post('/api/data/restore', async (req, res) => {
  const data = await loadSourceTables();
  await cacheStore(data);
  res.json(data);
});

/* Refresca solo personas (equipo + accesos) desde BigQuery, sin tocar el
   resto del estado guardado — usado cuando alguien nuevo recibe acceso y
   su navegador todavía tiene el store.json viejo cacheado. */
app.get('/api/personas', async (req, res) => {
  const config = await readJson('config.json');
  const { personas } = await loadPersonasLive(config);
  try {
    const stored = JSON.parse(await readFile(STORE_PATH, 'utf8'));
    stored.personas = personas;
    await cacheStore(stored);
  } catch {
    /* si todavía no hay store.json, /api/data lo va a componer completo */
  }
  res.json(personas);
});

const PORT = process.env.PORT || 3000;
// ponytail: en Vercel este archivo se importa como función serverless (ver
// vercel.json) — ahí no se llama listen(), Vercel maneja el socket.
if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
}

export default app;
