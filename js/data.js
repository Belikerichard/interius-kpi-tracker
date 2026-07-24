/* ===================== DATA LAYER =====================
   appData vive en el servidor Node (ver server.js), que persiste el blob
   completo en data/store.json. En el primer arranque el servidor lo compone
   a partir de las tablas fuente en /data; después, cada cambio que hagas en
   la app se guarda ahí vía POST /api/data. Para regresar a los datos
   originales, usa el botón "Restaurar datos de origen".

   Todas las llamadas van con el ID token de Google del usuario en curso
   (ver auth.js) — el servidor lo verifica y decide qué tanto de appData
   puede ver/guardar según su rol. */
import { appData, setAppData } from './state.js';
import { showToast } from './utils.js';
import { switchView } from './nav.js';
import { getIdToken, syncRoleFromAppData } from './auth.js';

async function authedFetch(url, opts = {}) {
  const token = getIdToken();
  if (!token) return { ok: false, status: 401 };
  return fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: `Bearer ${token}` } });
}

export async function loadData() {
  try {
    const res = await authedFetch('/api/data');
    if (!res.ok) return false;
    setAppData(await res.json());
    syncRoleFromAppData();
    return true;
  } catch (e) {
    console.error('No se pudo cargar la data del servidor. ¿Está corriendo `npm start`?', e);
    return false;
  }
}

export async function persist() {
  try {
    const res = await authedFetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appData),
    });
    if (res.status === 409) {
      const { data } = await res.json();
      if (data) setAppData(data);
      showToast('Alguien más guardó cambios primero. Se recargó la información más reciente.');
      switchView('dashboard');
      return false;
    }
    if (!res.ok) {
      showToast('No se pudo guardar (sesión vencida o sin permiso).');
      return false;
    }
    appData._rev = (await res.json())._rev;
    return true;
  } catch (e) {
    console.error('No se pudo guardar', e);
    showToast('No se pudo guardar. Revisa la consola.');
    return false;
  }
}

// Edita un empleado en BigQuery (ver bigquery.js/updateEmpleado) y refresca
// appData con lo que el servidor recompuso después de guardar.
export async function updateEmpleadoRemoto(id, fields) {
  try {
    const res = await authedFetch(`/api/empleados/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      showToast(body.error || 'No se pudo guardar en BigQuery.');
      return false;
    }
    setAppData(await res.json());
    return true;
  } catch (e) {
    console.error('No se pudo guardar el empleado', e);
    showToast('No se pudo guardar. Revisa la consola.');
    return false;
  }
}

export async function restoreSourceData() {
  try {
    const res = await authedFetch('/api/data/restore', { method: 'POST' });
    if (!res.ok) {
      showToast('No se pudo restaurar.');
      return;
    }
    setAppData(await res.json());
    showToast('Datos restaurados desde /data');
    switchView('dashboard');
  } catch (e) {
    console.error(e);
    showToast('No se pudo restaurar. Revisa la consola.');
  }
}
