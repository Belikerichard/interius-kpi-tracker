/* Estado compartido de la app. `appData` se reemplaza por completo al cargar
   o restaurar datos (ver data.js), por eso vive detrás de setAppData en vez
   de reasignarse directamente desde otros módulos. */
export const STORAGE_KEY = 'interius-kpi-tracker-data';

export let appData = {
  clientes: [],
  personas: [],
  kpis: [],
  headcount: [],
  bajas: [],
  empleados: [],
  rotacionMeta: 15,
};

export function setAppData(data) {
  appData = data;
}
