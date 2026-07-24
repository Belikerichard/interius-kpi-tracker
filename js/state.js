/* Estado compartido de la app. `appData` se reemplaza por completo al cargar
   o restaurar datos (ver data.js), por eso vive detrás de setAppData en vez
   de reasignarse directamente desde otros módulos. */
export let appData = {
  clientes: [],
  personas: [],
  kpis: [],
  headcount: [],
  bajas: [],
  empleados: [],
  empleadosTabla: [],
  dataQuality: { excluidos: 0, incompletos: [] },
  rotacionMeta: 15,
  googleClientId: '',
};

export function setAppData(data) {
  appData = data;
}
