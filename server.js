/* Servidor Express: sirve la app estática y persiste appData en el servidor
   (data/store.json) en vez de localStorage. Mismo contrato que antes: el
   cliente pide el blob completo y lo vuelve a mandar completo al guardar. */
import express from 'express';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

async function readJson(file) {
  return JSON.parse(await readFile(path.join(DATA_DIR, file), 'utf8'));
}

async function loadSourceTables() {
  const [clientes, personas, kpis, headcount, bajas, empleados, config] = await Promise.all([
    readJson('clientes.json'),
    readJson('personas.json'),
    readJson('kpis.json'),
    readJson('headcount.json'),
    readJson('bajas.json'),
    readJson('empleados.json'),
    readJson('config.json'),
  ]);
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
