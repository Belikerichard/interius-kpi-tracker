/* Punto de entrada: importar cada módulo registra sus listeners de UI;
   el arranque real de datos ocurre en el IIFE de abajo. */
import './nav.js';
import './modals.js';
import './views/dashboard.js';
import './views/clientes.js';
import './views/equipo.js';
import './views/kpis.js';
import './views/organigrama.js';
import './views/people.js';

import { loadData, restoreSourceData } from './data.js';
import { renderDashboard } from './views/dashboard.js';

const btnRestore = document.getElementById('btn-restore-source');
if (btnRestore) {
  btnRestore.addEventListener('click', () => {
    if (confirm('Esto reemplaza los datos actuales con las tablas originales de /data. ¿Continuar?')) {
      restoreSourceData();
    }
  });
}

(async function init() {
  await loadData();
  renderDashboard();
})();
