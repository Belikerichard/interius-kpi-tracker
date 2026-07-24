/* Punto de entrada: importar cada módulo registra sus listeners de UI;
   el arranque real (datos + login) ocurre en el IIFE de abajo. */
import './nav.js';
import './modals.js';
import './views/dashboard.js';
import './views/clientes.js';
import './views/equipo.js';
import './views/kpis.js';
import './views/organigrama.js';
import './views/people.js';

import { loadData, restoreSourceData } from './data.js';
import { showToast } from './utils.js';
import { renderDashboard } from './views/dashboard.js';
import { restoreSession, initGoogleSignIn, logout, currentUser } from './auth.js';
import { applyPermissionsToChrome, canEdit } from './permissions.js';

const ROLE_LABELS = { super_admin: 'Super Admin', admin: 'Admin', usuario: 'Usuario' };

// ponytail: iOS Safari won't fire :active/:hover anywhere without a touch listener present
document.addEventListener('touchstart', () => {}, { passive: true });

function showApp() {
  document.getElementById('view-login').style.display = 'none';
  document.getElementById('app-shell').style.display = 'flex';
  const badge = document.getElementById('user-badge');
  if (badge && currentUser) badge.textContent = `${currentUser.name} · ${ROLE_LABELS[currentUser.role] || currentUser.role}`;
  applyPermissionsToChrome();
  renderDashboard();
}

function showLoginDenied(email) {
  document.getElementById('login-denied-email').textContent = email;
  document.getElementById('login-denied').style.display = 'block';
}

function startGoogleSignIn(clientId) {
  initGoogleSignIn(clientId, document.getElementById('g-signin-button'), async (result) => {
    if (!result.ok) return showLoginDenied(result.email);
    if (await loadData()) {
      showApp();
    } else {
      logout();
      showToast('No se pudo cargar la información. Intenta de nuevo.');
    }
  });
}

document.getElementById('btn-try-another').addEventListener('click', () => {
  logout();
  document.getElementById('login-denied').style.display = 'none';
});

document.getElementById('btn-logout').addEventListener('click', () => {
  logout();
  location.reload();
});

const btnRestore = document.getElementById('btn-restore-source');
if (btnRestore) {
  btnRestore.addEventListener('click', () => {
    if (!canEdit()) return;
    if (confirm('Esto reemplaza los datos actuales con las tablas originales de /data. ¿Continuar?')) {
      restoreSourceData();
    }
  });
}

(async function init() {
  let googleClientId = '';
  try {
    ({ googleClientId } = await fetch('/api/config').then((r) => r.json()));
  } catch (e) {
    console.error('No se pudo cargar la configuración del servidor. ¿Está corriendo `npm start`?', e);
  }

  if (restoreSession() && (await loadData())) {
    showApp();
  } else {
    logout(); // limpia cualquier sesión guardada que ya no sirvió (vencida o sin acceso)
    startGoogleSignIn(googleClientId);
  }
})();
