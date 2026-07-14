/* ===================== AUTENTICACIÓN =====================
   Login con Google Identity Services + rol tomado de data/personas.json
   (campos `email` y `role`). IMPORTANTE: esto es una app 100% estática sin
   backend, así que este login NO es un perímetro de seguridad real — el ID
   token de Google se decodifica en el navegador sin verificar su firma, y
   cualquiera con las herramientas de desarrollador puede leer/modificar
   appData o el localStorage. Sirve para dar una identidad y ocultar/filtrar
   la UI según el rol, no para proteger datos sensibles de verdad. Si eso
   importa, se necesita mover la data y la verificación a un backend real. */
import { appData } from './state.js';

const SESSION_KEY = 'interius-kpi-tracker-session';

export let currentUser = null;

export function restoreSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw);
    const persona = appData.personas.find((p) => p.id === saved.personaId);
    if (!persona || !persona.role || (persona.email || '').toLowerCase() !== saved.email) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    currentUser = { ...saved, role: persona.role };
    return currentUser;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function decodeJwtPayload(token) {
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const json = decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join(''),
  );
  return JSON.parse(json);
}

function resolveCredential(response) {
  const payload = decodeJwtPayload(response.credential);
  const email = (payload.email || '').toLowerCase();
  const persona = appData.personas.find((p) => p.email && p.email.toLowerCase() === email && p.role);
  if (!persona) return { ok: false, email, name: payload.name };
  currentUser = { email, name: payload.name, picture: payload.picture, role: persona.role, personaId: persona.id };
  localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
  return { ok: true, user: currentUser };
}

function waitForGoogleId(timeoutMs = 5000) {
  return new Promise((resolve) => {
    const start = Date.now();
    (function check() {
      if (window.google?.accounts?.id) return resolve(true);
      if (Date.now() - start > timeoutMs) return resolve(false);
      setTimeout(check, 100);
    })();
  });
}

export async function initGoogleSignIn(clientId, buttonEl, onResult) {
  const ready = await waitForGoogleId();
  if (!ready) {
    buttonEl.innerHTML = `<p style="color:var(--rojo);font-size:12.5px;">No se pudo cargar el inicio de sesión de Google. Revisa tu conexión e intenta de nuevo.</p>`;
    return;
  }
  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: (response) => onResult(resolveCredential(response)),
  });
  window.google.accounts.id.renderButton(buttonEl, { theme: 'outline', size: 'large', text: 'signin_with', shape: 'pill', width: 280 });
  window.google.accounts.id.prompt();
}

export function logout() {
  currentUser = null;
  localStorage.removeItem(SESSION_KEY);
  if (window.google?.accounts?.id) google.accounts.id.disableAutoSelect();
}
