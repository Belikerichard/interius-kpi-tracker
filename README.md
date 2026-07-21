# Interius · KPI Tracker

Tracker de KPIs de negocio, clientes, equipo, organigrama y People Analytics para Interius.

## Estructura del proyecto

```
interius-kpi-tracker/
├── server.js              → servidor Express: sirve la app y la API /api/data
├── sheets.js              → lee la pestaña "DB Empleados" del Google Sheet
├── index.html            → punto de entrada de la app
├── css/
│   └── styles.css        → estilos (marca Interius)
├── js/
│   ├── app.js             → entry point: importa todo, gate de login y arranca la app
│   ├── state.js           → estado compartido (appData) y su setter
│   ├── calc.js             → cálculos puros (achievement, avgAchievement, ratings...)
│   ├── data.js            → carga/persistencia (fetch a /api/data)
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
│       └── people.js         → People Analytics (estructura, antigüedad, demografía, calidad de datos — solo Estatus=Activo)
└── data/                  → AQUÍ VIVEN LAS FUENTES DE DATOS
    ├── clientes.json      → tabla de clientes
    ├── personas.json      → SOLO control de acceso: [{ email, role }] de quien puede iniciar sesión
    ├── kpis.json          → tabla de KPIs de negocio por cliente
    ├── headcount.json     → tabla de headcount por área / período
    ├── config.json        → configuración general (meta de rotación, Google Client ID, sheetId)
    └── store.json         → (generado, no versionado) snapshot actual de appData
```

`js/app.js` se carga como `<script type="module">`, así que cada archivo de
`js/` es un módulo ES nativo (`import`/`export`) — no hay bundler ni paso de
build, el navegador los resuelve directamente.

Cada archivo `.json` dentro de `/data` (salvo `store.json`) funciona como una
"tabla": es una lista de objetos con una estructura fija. Edítalos directamente
para ajustar clientes, KPIs o headcount, o hazlo desde la propia app.

### Equipo, antigüedad y bajas vienen de Google Sheets

Estas tres tablas ya **no** viven en `/data` — se leen en vivo de la pestaña
**"DB Empleados"** del Google Sheet configurado en `data/config.json`
(`sheetId`), vía `sheets.js`. Cada vez que el servidor recompone los datos
(primer arranque o "Restaurar datos de origen"), vuelve a leer esa pestaña.

- El Sheet debe estar compartido como **"Cualquiera con el enlace puede
  ver"** — el servidor lo lee sin iniciar sesión, por su export CSV público
  (`.../export?format=csv`). Si lo vuelves a poner privado, la app deja de
  poder leerlo.
- Columnas que usa: `INTERIUS ID`, `Nombre Completo`, `Puesto Completo`,
  `Nivel de Puesto`, `Area`, `Reporta a:`, `Sexo`, `Edad`, `Fecha de
  Contratación`, `Estatus` (`Activo` / `Inactivo`), `Tipo de Baja`, `Motivo
  de Baja`, `Fecha de Baja`, `Correo`.
- `Area` es texto libre capturado en el Sheet (no se deriva de nada). Vacío
  cae en "Sin área" (ej. el CEO, que no pertenece a un área) y se marca en
  `dataQuality.incompletos`. `js/views/people.js` tiene un orden preferido
  (`AREAS_ORDEN`) para las gráficas, pero cualquier valor nuevo que no esté
  en esa lista igual se muestra (al final, en vez de desaparecer) — así que
  agregar/renombrar áreas en el Sheet no rompe nada, aunque para que respete
  el orden hay que sumarlas ahí también.
- `sheets.js` también corrige typos conocidos de `Puesto Completo`
  (`PUESTO_FIXES`) y colapsa espacios extra en nombre/puesto/área antes de
  mostrar el dato.
- Filas con `Nombre Completo` en blanco se ignoran (y se cuentan en
  `dataQuality.excluidos` si su `Estatus` era `Activo`). Filas `Activo`
  alimentan Equipo/Organigrama/People Analytics; filas `Inactivo` con `Fecha
  de Baja` alimentan `appData.bajas` (con `nivelPuesto` incluido), que usa la
  subtab "Rotación" de People Analytics. Activos con `Nivel de Puesto` vacío
  o "Por Definir" cuentan en el headcount pero se listan en
  `dataQuality.incompletos`.
- El Sheet no tiene fecha de cambio de puesto, así que `fechaPuesto` usa la
  misma fecha que `fechaIngreso` (fecha de contratación).
- El Sheet **no** tiene el rol de acceso (`super_admin` / `admin` /
  `usuario`) — eso sigue viviendo en `data/personas.json`, a propósito: no
  quieres que cualquiera con el link del Sheet pueda otorgarse acceso de
  administrador. Ver "Dar de alta o cambiar accesos" abajo.

> Para apuntar a otra fuente de datos (otro Sheet, una base de datos, un API),
> el lugar a tocar es `loadEmpleadosFromSheet()` en `sheets.js` — o
> `loadSourceTables()` en `server.js` si también quieres mover clientes/KPIs.

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
`role`), se le niega el acceso — sin importar si esa persona sí existe como
`Activo` en el Sheet.

Roles disponibles:

| Rol           | Ve                                                                              | Edita                         |
| ------------- | ------------------------------------------------------------------------------- | ----------------------------- |
| `super_admin` | Todo                                                                            | Todo (clientes, equipo, KPIs) |
| `admin`       | Todo excepto People Analytics                                                   | Nada                          |
| `usuario`     | Solo los clientes/KPIs donde es responsable, y a sí mismo en Equipo/Organigrama | Nada                          |

### Configurar tu Google OAuth Client ID

1. En [Google Cloud Console](https://console.cloud.google.com/apis/credentials), crea
   un **OAuth 2.0 Client ID** de tipo "Aplicación web".
2. Agrega el/los orígenes donde correrá la app (ej. `http://localhost:3000` para
   desarrollo, y tu dominio real en producción) en **Authorized JavaScript origins**.
3. Copia el Client ID (`....apps.googleusercontent.com`) y pégalo en el campo
   `googleClientId` de `data/config.json`, reemplazando el placeholder.

### Dar de alta o cambiar accesos

Dos requisitos, en dos lugares distintos:

1. La persona debe existir como fila `Activo` en la pestaña "DB Empleados"
   del Sheet, con su `Correo` correcto.
2. Agrega ese mismo correo a `data/personas.json` con su `role`
   (`super_admin`, `admin` o `usuario`), ej. `{ "email": "ana@interius.com.mx", "role": "admin" }`.

Quien esté en el Sheet pero no en `data/personas.json` (o viceversa) no
puede iniciar sesión.

### ⚠️ Esto no es un perímetro de seguridad real

El servidor Express (`server.js`) sirve `/api/data` sin verificar quién hace
la llamada: cualquiera con acceso a la URL puede leer o sobreescribir todo el
estado, y el ID token de Google se decodifica en el navegador sin verificar su
firma. El login sirve para dar identidad y ocultar/filtrar la interfaz según
el rol — no para proteger información sensible de alguien con las
herramientas de desarrollador abiertas. Si eso te importa (datos realmente
confidenciales), `/api/data` necesita autenticación real (verificar el ID
token en el servidor y aplicar permisos por rol ahí, no solo en el cliente).

Lo mismo aplica al Google Sheet: al estar compartido como "cualquiera con el
enlace puede ver", cualquiera con esa URL puede leer nombres, puestos, fechas
de contratación y motivos de baja de todo el equipo, sin iniciar sesión.

## Módulos de la app

- **Dashboard**: cumplimiento general, por cliente y por persona.
- **Clientes**: cartera de clientes y sus KPIs de negocio.
- **Equipo**: personas, sus KPIs asignados y calificación de desempeño estimada.
- **Organigrama**: quién le reporta a quién.
- **KPIs**: tabla editable de todos los KPIs de negocio.
- **People Analytics**: Estructura, Antigüedad, Demografía, Contrataciones,
  Calidad de datos y Cruces estratégicos — es una **foto de la plantilla
  activa** (`Estatus = Activo` únicamente, no análisis de flujo de
  entradas/salidas) y es **solo de consulta** (no se captura información ahí,
  solo se visualiza lo que ya existe en `/data` y el Sheet).
