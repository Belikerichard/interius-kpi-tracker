/* ===================== AUTENTICACIÓN =====================
   Login con Google Identity Services. El ID token que entrega Google se
   manda en cada llamada al servidor (Authorization: Bearer) y ahí SÍ se
   verifica su firma (ver server.js) — a diferencia de antes, decodificarlo
   aquí en el navegador (decodeJwtPayload) es solo para leer nombre/foto/
   correo y mostrarlos en la UI, no la fuente de verdad de la autorización.
   El rol de cada quien sale de data/personas.json (campos `email` y `role`)
   vía el servidor. */
import { appData } from './state.js';

const SESSION_KEY = 'interius-kpi-tracker-session';

export let currentUser = null;

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

// ponytail: el ID token de Google vence en ~1h. Armar un refresh silencioso
// depende de que el One Tap de Google reaparezca sin interacción, y no
// siempre lo hace si el usuario ya lo cerró antes — frágil. Para el uso
// interno esporádico de esta app, cuando vence simplemente se pide iniciar
// sesión de nuevo (un clic, ya con la cuenta de Google activa en el
// navegador) en vez de perseguir un refresh automático.
export function restoreSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw);
    const exp = decodeJwtPayload(saved.idToken).exp * 1000;
    if (Date.now() >= exp) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    currentUser = saved;
    return currentUser;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function getIdToken() {
  return currentUser?.idToken || null;
}

/* Vuelve a fijar rol/personaId desde el appData recién cargado del
   servidor — ese es el que ya pasó por la verificación de rol en
   requireAuth, así que si cambió (o se revocó) se refleja aquí sin esperar
   al siguiente login. */
export function syncRoleFromAppData() {
  if (!currentUser) return;
  const persona = findAuthorizedPersona(currentUser.email);
  if (!persona) return;
  currentUser.role = persona.role;
  currentUser.personaId = persona.id;
  localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
}

function findAuthorizedPersona(email) {
  return appData.personas.find((p) => p.email && p.email.toLowerCase() === email && p.role);
}

/* Si el correo no aparece en el appData ya cacheado, puede ser porque se
   dio de alta a alguien nuevo (en la tabla o en data/personas.json) después
   de que el servidor guardó su copia. Antes de negar el acceso, se refresca
   personas desde el servidor —que además actualiza su propio cache— y se
   reintenta una vez. También es el camino normal en el primer login de la
   sesión: appData todavía no se ha cargado, así que esto siempre dispara. */
async function refreshPersonasFromSource(idToken) {
  try {
    const res = await fetch('/api/personas', { headers: { Authorization: `Bearer ${idToken}` } });
    if (res.ok) appData.personas = await res.json();
  } catch {
    /* sin conexión al servidor: seguimos con lo que ya había en caché */
  }
}

async function resolveCredential(response) {
  const idToken = response.credential;
  const payload = decodeJwtPayload(idToken);
  const email = (payload.email || '').toLowerCase();
  let persona = findAuthorizedPersona(email);
  if (!persona) {
    await refreshPersonasFromSource(idToken);
    persona = findAuthorizedPersona(email);
  }
  if (!persona) return { ok: false, email, name: payload.name };
  currentUser = { email, name: payload.name, picture: payload.picture, role: persona.role, personaId: persona.id, idToken };
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
    callback: async (response) => onResult(await resolveCredential(response)),
  });
  window.google.accounts.id.renderButton(buttonEl, { theme: 'outline', size: 'large', text: 'signin_with', shape: 'pill', width: 280 });
  window.google.accounts.id.prompt();
}

export function logout() {
  currentUser = null;
  localStorage.removeItem(SESSION_KEY);
  if (window.google?.accounts?.id) google.accounts.id.disableAutoSelect();
}
