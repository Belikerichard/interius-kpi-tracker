/* Servidor Express: sirve la app estática y persiste appData en el servidor
   (data/store.json) en vez de localStorage. Mismo contrato que antes: el
   cliente pide el blob completo y lo vuelve a mandar completo al guardar.
   Equipo, antigüedad y bajas ya no viven en /data: se leen en vivo de la
   pestaña "DB Empleados" del Google Sheet configurado en config.json (ver
   sheets.js). data/personas.json quedó solo como el control de acceso —
   qué correo tiene qué rol de login — porque esa asignación no existe en
   el Sheet y no se debe mezclar ahí. */
import express from 'express';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEmpleadosFromSheet } from './sheets.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

async function readJson(file) {
  return JSON.parse(await readFile(path.join(DATA_DIR, file), 'utf8'));
}

async function loadPersonasLive(config) {
  const [{ personas, empleados, bajas }, access] = await Promise.all([loadEmpleadosFromSheet(config.sheetId), readJson('personas.json')]);
  const roleByEmail = new Map(access.map((a) => [a.email.toLowerCase(), a.role]));
  return { personas: personas.map((p) => ({ ...p, role: roleByEmail.get(p.email) })), empleados, bajas };
}

async function loadSourceTables() {
  const [clientes, kpis, headcount, config] = await Promise.all([
    readJson('clientes.json'),
    readJson('kpis.json'),
    readJson('headcount.json'),
    readJson('config.json'),
  ]);
  const { personas, empleados, bajas } = await loadPersonasLive(config);
  return {
    clientes,
    personas,
    kpis,
    headcount,
    bajas,
    empleados,
    rotacionMeta: config.rotacionMeta,
    googleClientId: config.googleClientId,
  };
}

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

app.get('/api/data', async (req, res) => {
  try {
    res.json(JSON.parse(await readFile(STORE_PATH, 'utf8')));
  } catch {
    const data = await loadSourceTables();
    await writeFile(STORE_PATH, JSON.stringify(data));
    res.json(data);
  }
});

app.post('/api/data', async (req, res) => {
  await writeFile(STORE_PATH, JSON.stringify(req.body));
  res.json({ ok: true });
});

app.post('/api/data/restore', async (req, res) => {
  const data = await loadSourceTables();
  await writeFile(STORE_PATH, JSON.stringify(data));
  res.json(data);
});

/* Refresca solo personas (equipo + accesos) desde el Sheet, sin tocar el
   resto del estado guardado — usado cuando alguien nuevo recibe acceso y
   su navegador todavía tiene el store.json viejo cacheado. */
app.get('/api/personas', async (req, res) => {
  const config = await readJson('config.json');
  const { personas } = await loadPersonasLive(config);
  try {
    const stored = JSON.parse(await readFile(STORE_PATH, 'utf8'));
    stored.personas = personas;
    await writeFile(STORE_PATH, JSON.stringify(stored));
  } catch {
    /* si todavía no hay store.json, /api/data lo va a componer completo */
  }
  res.json(personas);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
