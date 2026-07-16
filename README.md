# Interius · KPI Tracker

Tracker de KPIs de negocio, clientes, equipo, organigrama y People Analytics para Interius.

## Estructura del proyecto

```
interius-kpi-tracker/
├── server.js              → servidor Express: sirve la app y la API /api/data
├── index.html            → punto de entrada de la app
├── css/
│   └── styles.css        → estilos (marca Interius)
├── js/
│   ├── app.js             → entry point: importa todo, gate de login y arranca la app
│   ├── state.js           → estado compartido (appData) y su setter
│   ├── calc.js             → cálculos puros (achievement, avgAchievement, ratings...)
│   ├── data.js            → carga/persistencia (fetch a /data, localStorage)
│   ├── utils.js            → helpers de UI y fechas (toast, initials, antigüedad...)
│   ├── auth.js              → login con Google, sesión, rol del usuario actual
│   ├── permissions.js       → qué puede ver/editar cada rol
│   ├── nav.js               → cambio entre vistas principales
│   ├── modals.js            → alta/edición de cliente, persona y KPI
│   └── views/
│       ├── dashboard.js      → dashboard general
│       ├── clientes.js       → listado y detalle de clientes
│       ├── equipo.js         → listado y detalle de equipo
│       ├── kpis.js           → tabla editable de KPIs
│       ├── organigrama.js    → árbol de reporte
│       └── people.js         → People Analytics (HC, bajas, rotación, antigüedad)
└── data/                  → AQUÍ VIVEN LAS FUENTES DE DATOS
    ├── clientes.json      → tabla de clientes
    ├── personas.json      → tabla de equipo (incluye a quién le reporta cada quien)
    ├── kpis.json          → tabla de KPIs de negocio por cliente
    ├── headcount.json     → tabla de headcount por área / período
    ├── bajas.json         → tabla de bajas (voluntarias / involuntarias)
    ├── empleados.json     → tabla de empleados para antigüedad y antigüedad en el puesto
    ├── config.json        → configuración general (meta de rotación, Google Client ID)
    └── store.json         → (generado, no versionado) snapshot actual de appData
```

`js/app.js` se carga como `<script type="module">`, así que cada archivo de
`js/` es un módulo ES nativo (`import`/`export`) — no hay bundler ni paso de
build, el navegador los resuelve directamente.

Cada archivo `.json` dentro de `/data` (salvo `store.json`) funciona como una
"tabla": es una lista de objetos con una estructura fija. Hoy están llenos con
datos de ejemplo — edítalos directamente para reemplazarlos con tu información
real, o mantenlos como base y haz los ajustes finos desde la propia app.

> Cuando quieras conectar una fuente de datos real (una base de datos, un API
> externo, Google Sheets, etc.), el único lugar que tendrías que tocar es la
> función `loadSourceTables()` en `server.js`: hoy lee estos JSON del disco,
> pero podrías apuntarla a tu fuente real sin cambiar el resto de la app.

## Cómo funciona la persistencia

La app corre sobre un servidor Node/Express (`server.js`) que expone una API
(`/api/data`) y guarda el estado completo en `data/store.json`.

1. La primera vez que arrancas el servidor, `GET /api/data` compone los datos
   a partir de `/data/*.json` y los guarda en `data/store.json`.
2. A partir de ahí, cualquier cambio que hagas en la app (actualizar un KPI,
   agregar un cliente, mover a alguien en el organigrama, etc.) se manda por
   `POST /api/data` y se guarda en `data/store.json` — no se sobreescriben las
   tablas fuente originales.
3. Si quieres regresar a los datos originales de `/data`, usa el link
   **"Restaurar datos de origen"** al fondo del menú lateral (llama a
   `POST /api/data/restore`).

`data/store.json` es estado generado (como antes era el `localStorage` del
navegador) — no está versionado en git.

## Cómo correrlo en VS Code

```bash
npm install   # una sola vez
npm start
```

y abre `http://localhost:3000`. Ya no funciona con Live Server ni con
doble clic sobre `index.html`: la app necesita el servidor Express para leer
y guardar datos vía `/api/data`.

## Calidad de código

El proyecto es HTML/CSS/JS plano, sin build. Para lint y formato:

```bash
npm install   # una sola vez, instala eslint + prettier como devDependencies
npm run lint    # ESLint sobre js/
npm run format  # Prettier sobre js/, css/ y *.html
```

## Login con Google y roles

La app pide iniciar sesión con una cuenta de Google antes de mostrar cualquier
vista. El rol de cada quien sale de `data/personas.json` (campos `email` y
`role`); si el correo con el que alguien entra no aparece ahí (o no tiene
`role`), se le niega el acceso.

Roles disponibles:

| Rol | Ve | Edita |
|---|---|---|
| `super_admin` | Todo | Todo (clientes, equipo, KPIs) |
| `admin` | Todo excepto People Analytics | Nada |
| `usuario` | Solo los clientes/KPIs donde es responsable, y a sí mismo en Equipo/Organigrama | Nada |

### Configurar tu Google OAuth Client ID

1. En [Google Cloud Console](https://console.cloud.google.com/apis/credentials), crea
   un **OAuth 2.0 Client ID** de tipo "Aplicación web".
2. Agrega el/los orígenes donde correrá la app (ej. `http://localhost:3000` para
   desarrollo, y tu dominio real en producción) en **Authorized JavaScript origins**.
3. Copia el Client ID (`....apps.googleusercontent.com`) y pégalo en el campo
   `googleClientId` de `data/config.json`, reemplazando el placeholder.

### Dar de alta o cambiar accesos

Edita `data/personas.json` y agrégale `email` (la cuenta de Google con la que
esa persona inicia sesión) y `role` (`super_admin`, `admin` o `usuario`) a
quien necesite entrar. Quien no tenga esos dos campos no puede iniciar sesión.

### ⚠️ Esto no es un perímetro de seguridad real

El servidor Express (`server.js`) sirve `/api/data` sin verificar quién hace
la llamada: cualquiera con acceso a la URL puede leer o sobreescribir todo el
estado, y el ID token de Google se decodifica en el navegador sin verificar su
firma. El login sirve para dar identidad y ocultar/filtrar la interfaz según
el rol — no para proteger información sensible de alguien con las
herramientas de desarrollador abiertas. Si eso te importa (datos realmente
confidenciales), `/api/data` necesita autenticación real (verificar el ID
token en el servidor y aplicar permisos por rol ahí, no solo en el cliente).

## Módulos de la app

- **Dashboard**: cumplimiento general, por cliente y por persona.
- **Clientes**: cartera de clientes y sus KPIs de negocio.
- **Equipo**: personas, sus KPIs asignados y calificación de desempeño estimada.
- **Organigrama**: quién le reporta a quién.
- **KPIs**: tabla editable de todos los KPIs de negocio.
- **People Analytics**: HC, Bajas, Rotación, Antigüedad y Antigüedad en el puesto
  — este módulo es **solo de consulta** (no se captura información ahí, solo se
  visualiza lo que ya existe en `/data`).
