# Interius · KPI Tracker

Tracker de KPIs de negocio, clientes, equipo, organigrama y People Analytics para Interius.

## Estructura del proyecto

```
interius-kpi-tracker/
├── index.html            → punto de entrada de la app
├── css/
│   └── styles.css        → estilos (marca Interius)
├── js/
│   ├── app.js             → entry point: importa todo y arranca la app
│   ├── state.js           → estado compartido (appData) y su setter
│   ├── calc.js             → cálculos puros (achievement, avgAchievement, ratings...)
│   ├── data.js            → carga/persistencia (fetch a /data, localStorage)
│   ├── utils.js            → helpers de UI y fechas (toast, initials, antigüedad...)
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
    └── config.json        → configuración general (ej. meta de rotación)
```

`js/app.js` se carga como `<script type="module">`, así que cada archivo de
`js/` es un módulo ES nativo (`import`/`export`) — no hay bundler ni paso de
build, el navegador los resuelve directamente.

Cada archivo `.json` dentro de `/data` funciona como una "tabla": es una lista de
objetos con una estructura fija. Hoy están llenos con datos de ejemplo — edítalos
directamente para reemplazarlos con tu información real, o mantenlos como base y
haz los ajustes finos desde la propia app.

> Cuando quieras conectar una fuente de datos real (una base de datos, un API,
> Google Sheets, etc.), el único lugar que tendrías que tocar es la función
> `loadSourceTables()` en `js/app.js`: hoy hace `fetch()` a estos JSON, pero podrías
> apuntarla a tu API sin cambiar el resto de la aplicación.

## Cómo funciona la persistencia

1. La primera vez que abres la app, carga los datos desde `/data/*.json`.
2. A partir de ahí, cualquier cambio que hagas (actualizar un KPI, agregar un
   cliente, mover a alguien en el organigrama, etc.) se guarda en el
   `localStorage` de tu navegador — no se sobreescriben los archivos `.json`.
3. Si quieres regresar a los datos originales de `/data`, usa el link
   **"Restaurar datos de origen"** al fondo del menú lateral.

## Cómo correrlo en VS Code

Esta app usa `fetch()` para leer los archivos de `/data`, por lo que **no puedes
abrir `index.html` directamente con doble clic** (los navegadores bloquean
`fetch` sobre `file://`). Necesitas servirlo con un servidor local. Dos opciones:

### Opción A — Extensión Live Server (más fácil)
1. Instala la extensión **Live Server** de Ritwick Dey desde el marketplace de VS Code.
2. Click derecho sobre `index.html` → **"Open with Live Server"**.

### Opción B — Node / npx (sin instalar nada permanente)
```bash
npx serve .
```
y abre la URL que te indique en consola (normalmente `http://localhost:3000`).

También incluí un `package.json` con un script `npm start` que hace lo mismo:
```bash
npm start
```

> Nota: al usar `<script type="module">`, los mismos navegadores que bloquean
> `fetch` sobre `file://` también bloquean la carga de módulos ahí — otra
> razón más para siempre servir el proyecto con un servidor local.

## Calidad de código

El proyecto es HTML/CSS/JS plano, sin build. Para lint y formato:

```bash
npm install   # una sola vez, instala eslint + prettier como devDependencies
npm run lint    # ESLint sobre js/
npm run format  # Prettier sobre js/, css/ y *.html
```

## Módulos de la app

- **Dashboard**: cumplimiento general, por cliente y por persona.
- **Clientes**: cartera de clientes y sus KPIs de negocio.
- **Equipo**: personas, sus KPIs asignados y calificación de desempeño estimada.
- **Organigrama**: quién le reporta a quién.
- **KPIs**: tabla editable de todos los KPIs de negocio.
- **People Analytics**: HC, Bajas, Rotación, Antigüedad y Antigüedad en el puesto
  — este módulo es **solo de consulta** (no se captura información ahí, solo se
  visualiza lo que ya existe en `/data`).
