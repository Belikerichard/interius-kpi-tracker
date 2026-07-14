/* ===================== DATA LAYER =====================
   Las "fuentes de datos" de la app viven en la carpeta /data como
   archivos JSON (una tabla por archivo). En el primer arranque se
   cargan desde ahí; después, los cambios que hagas en la app se
   guardan en localStorage del navegador. Para regresar a los datos
   originales de /data, usa el botón "Restaurar datos de origen" o
   borra la clave `interius-kpi-tracker-data` del localStorage.

   Para conectar una fuente de datos real (una base de datos, un API,
   Google Sheets, etc.), el único lugar que tendrías que tocar es
   loadSourceTables(): hoy hace fetch() a estos JSON, pero podrías
   apuntarla a tu API sin cambiar el resto de la aplicación. */
import { STORAGE_KEY, appData, setAppData } from './state.js';
import { showToast } from './utils.js';
import { switchView } from './nav.js';

export async function loadSourceTables() {
  const [clientes, personas, kpis, headcount, bajas, empleados, config] = await Promise.all([
    fetch('data/clientes.json').then((r) => r.json()),
    fetch('data/personas.json').then((r) => r.json()),
    fetch('data/kpis.json').then((r) => r.json()),
    fetch('data/headcount.json').then((r) => r.json()),
    fetch('data/bajas.json').then((r) => r.json()),
    fetch('data/empleados.json').then((r) => r.json()),
    fetch('data/config.json').then((r) => r.json()),
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

export async function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (!parsed.headcount) parsed.headcount = [];
      if (!parsed.bajas) parsed.bajas = [];
      if (!parsed.empleados) parsed.empleados = [];
      if (parsed.rotacionMeta === undefined) parsed.rotacionMeta = 15;
      if (!parsed.googleClientId) {
        /* Cache viejo de antes del login: toma el client ID actual de /data/config.json
           sin pisar el resto de los datos ya guardados. */
        parsed.googleClientId = (await fetch('data/config.json').then((r) => r.json())).googleClientId;
      }
      setAppData(parsed);
      return;
    } catch {
      /* si el JSON guardado está corrupto, cae a recargar de /data */
    }
  }
  try {
    setAppData(await loadSourceTables());
    await persist();
  } catch (e) {
    console.error('No se pudieron cargar las tablas fuente en /data. ¿Estás sirviendo el proyecto con un servidor local?', e);
    showToast('No se pudieron cargar los datos de /data. Revisa la consola.');
  }
}

export async function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
  } catch (e) {
    console.error('No se pudo guardar', e);
  }
}

export async function restoreSourceData() {
  try {
    setAppData(await loadSourceTables());
    await persist();
    showToast('Datos restaurados desde /data');
    switchView('dashboard');
  } catch (e) {
    console.error(e);
    showToast('No se pudo restaurar. Revisa la consola.');
  }
}
