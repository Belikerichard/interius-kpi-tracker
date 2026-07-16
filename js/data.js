/* ===================== DATA LAYER =====================
   appData vive en el servidor Node (ver server.js), que persiste el blob
   completo en data/store.json. En el primer arranque el servidor lo compone
   a partir de las tablas fuente en /data; después, cada cambio que hagas en
   la app se guarda ahí vía POST /api/data. Para regresar a los datos
   originales, usa el botón "Restaurar datos de origen". */
import { appData, setAppData } from './state.js';
import { showToast } from './utils.js';
import { switchView } from './nav.js';

export async function loadData() {
  try {
    setAppData(await fetch('/api/data').then((r) => r.json()));
  } catch (e) {
    console.error('No se pudo cargar la data del servidor. ¿Está corriendo `npm start`?', e);
    showToast('No se pudieron cargar los datos del servidor. Revisa la consola.');
  }
}

export async function persist() {
  try {
    await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appData),
    });
  } catch (e) {
    console.error('No se pudo guardar', e);
  }
}

export async function restoreSourceData() {
  try {
    setAppData(await fetch('/api/data/restore', { method: 'POST' }).then((r) => r.json()));
    showToast('Datos restaurados desde /data');
    switchView('dashboard');
  } catch (e) {
    console.error(e);
    showToast('No se pudo restaurar. Revisa la consola.');
  }
}
