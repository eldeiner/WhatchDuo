# CineDúo · WatchTogether

Mira **el mismo video, al mismo tiempo**, con otra persona: una PC como host y un móvil como invitado. El servidor es la fuente de verdad del reloj de reproducción, así que play, pausa, saltos y velocidad llegan a ambos lados en milisegundos —aunque uno pierda la conexión un momento.

> **MVP desplegable** (PWA instalable + API + WebSocket) con TypeScript estricto, tests unitarios/integración y E2E con dos contextos (PC y móvil).

---

## Características

- **Salas privadas** con código de 6 caracteres (CSPRNG) y enlace para compartir.
- **Acceso sin cuentas**: apodo + token de participante firmado (HMAC-SHA256).
- **Sincronización autoritativa** con reloj NTP-like (mediana de muestras) y corrección en tres niveles (seek duro, micro-ajuste de velocidad, alineación en pausa).
- **Control solo del host**, con corazón cada 4 s; el servidor re-ancla si el host se desvía.
- **Cesión de control** y **promoción automática** si el host no vuelve en 30 s.
- **Chat, reacciones flotantes y presencia** en tiempo real.
- **Reconexión** transparente con el mismo token, historial de chat vía REST.
- **PWA** instalable: manifest, service worker (nunca cachea video, API ni sockets), pantalla completa, safe areas, wake lock.
- **Video desde YouTube, Vimeo o archivo propio**: enlaces de YouTube y Vimeo se reproducen en un reproductor incrustado y sincronizado; también se admiten MP4, WebM y HLS (hls.js) por URL directa o archivo local. Las plataformas con DRM (Netflix, Disney+, Prime Video…) se rechazan con un aviso claro.
- **UI oscura de cine**, mobile-first y accesible (foco visible, roles ARIA, teclado, `prefers-reduced-motion`).

---

## Stack

| Capa     | Tecnología                                                           |
| -------- | -------------------------------------------------------------------- |
| Monorepo | npm workspaces, TypeScript estricto                                  |
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS 3, Zustand 5, hls.js |
| Backend  | Node.js, Express 4, Socket.IO 4, Zod                                 |
| Datos    | Prisma 6 + SQLite (dev/E2E) · esquema PostgreSQL incluido            |
| Tests    | Vitest (unit + integración) · Playwright (E2E, dos contextos)        |
| Deploy   | Docker multi-stage + Docker Compose                                  |

---

## Inicio rápido (desarrollo)

Requisitos: **Node.js ≥ 20.11** y npm ≥ 10.

```bash
npm install

# Backend
cp apps/server/.env.example apps/server/.env
npm run db:migrate
npm run db:seed          # crea la sala DEMO24 (Ana host / Leo invitado)

# Frontend
cp apps/web/.env.example apps/web/.env.local   # ya apunta a http://localhost:4000

npm run dev
```

- Web: <http://localhost:3000>
- API: <http://localhost:4000/api/health>
- Sala demo: <http://localhost:3000/room/DEMO24>

Crea una sala desde la portada, comparte el enlace y ábrelo en el móvil (misma red: usa la IP local de tu PC en lugar de `localhost`). Para probar el video incluido, pulsa **«Usar el video de ejemplo»** al crear la sala.

> **Windows/PowerShell:** los comandos `cp` se pueden sustituir por `Copy-Item`. Los scripts `npm run …` funcionan igual.

### Variables de entorno

| Variable                   | Dónde  | Descripción                                                        |
| -------------------------- | ------ | ------------------------------------------------------------------ |
| `DATABASE_URL`             | server | `file:./dev.db` (relativo a `apps/server/prisma`) o URL PostgreSQL |
| `TOKEN_SECRET`             | server | Secreto HMAC ≥ 16 chars; **cámbialo en producción**                |
| `PORT`, `HOST`             | server | Por defecto `4000`, `0.0.0.0`                                      |
| `WEB_ORIGIN`               | server | Origen usado al construir enlaces de invitación                    |
| `CORS_ORIGINS`             | server | Lista separada por comas de orígenes permitidos                    |
| `HOST_DISCONNECT_GRACE_MS` | server | Espera antes de promover host (mín. 100, def. 30000)               |
| `MAX_PARTICIPANTS`         | server | Límite de participantes por sala (2–10, def. 4)                    |
| `NEXT_PUBLIC_API_URL`      | web    | URL del backend sin barra final                                    |

---

## Scripts

| Comando                                       | Qué hace                                 |
| --------------------------------------------- | ---------------------------------------- |
| `npm run dev`                                 | Backend + frontend en modo desarrollo    |
| `npm run build`                               | Compila shared, server y web             |
| `npm start`                                   | Arranca la build de producción           |
| `npm run typecheck`                           | TypeScript estricto en los tres paquetes |
| `npm run lint` / `npm run format:check`       | ESLint / Prettier                        |
| `npm test`                                    | Vitest: shared (33) + server (30)        |
| `npm run test:e2e`                            | Playwright con host PC y guest móvil     |
| `npm run test:e2e:install`                    | Instala navegadores de Playwright        |
| `npm run db:migrate` / `db:seed` / `db:reset` | Prisma (SQLite de desarrollo)            |

---

## Estructura

```
WatchDD/
├─ apps/
│  ├─ server/
│  │  ├─ prisma/            schema SQLite + variante PostgreSQL, migraciones, seed
│  │  ├─ src/
│  │  │  ├─ config/         validación de entorno con Zod
│  │  │  ├─ lib/            tokens, rate limit, errores, logger, Prisma
│  │  │  ├─ realtime/       Socket.IO, presencia, host grace, handlers
│  │  │  ├─ routes/         REST (/api/rooms, /api/health)
│  │  │  └─ services/       estado autoritativo, persistencia, comandos
│  │  └─ test/              Vitest: unitarios + integración con Socket.IO
│  └─ web/
│     ├─ public/            manifest, sw.js, iconos, videos/demo.mp4 (CC0)
│     └─ src/
│        ├─ app/            Next.js App Router (portada, sala, offline)
│        ├─ components/     home, room, ui, PWA, icons
│        └─ lib/            store Zustand, socket, reloj, storage, acciones
├─ packages/shared/         contratos, esquemas Zod y matemática de sync
├─ e2e/                     Playwright
├─ docs/                    arquitectura, sync, API, eventos, deploy, checklist
└─ docker/                  Dockerfiles server/web + compose
```

---

## Cómo funciona la sincronía (resumen)

1. Al conectar, el cliente envía 5 pings espaciados ~280 ms. Con cada `pong` calcula el offset como `serverTime − (t0 + t1)/2` y se queda con la **mediana** de las mejores muestras.
2. Con el estado autoritativo, la posición esperada es:

   ```text
   expected = position + max(0, serverNow − updatedAt) / 1000 × playbackRate
   ```

3. El invitado compara su `video.currentTime` con `expected` cada segundo:
   - **≥ 0,75 s** → seek directo.
   - **0,3–0,75 s** → velocidad ±5 % durante 2 s.
   - **< 0,3 s** → nada.
   - **En pausa** → alineación exacta si supera 0,1 s.
4. El host envía su posición real cada 4 s. Si el servidor detecta más de 0,4 s de desviación, incrementa versión y emite `player:sync`.
5. El cliente ignora cualquier versión ≤ la local, evitando ecos y saltos atrás.

Detalle completo en [`docs/SYNC.md`](docs/SYNC.md).

---

## API y eventos

- REST: [`docs/API.md`](docs/API.md)
- Socket.IO: [`docs/EVENTS.md`](docs/EVENTS.md)
- Arquitectura: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

Resumen REST:

| Método | Ruta                        | Auth         |
| ------ | --------------------------- | ------------ |
| `POST` | `/api/rooms`                | —            |
| `GET`  | `/api/rooms/:code`          | —            |
| `POST` | `/api/rooms/:code/join`     | —            |
| `GET`  | `/api/rooms/:code/messages` | Bearer token |
| `GET`  | `/api/health`               | —            |

---

## Tests

```bash
npm test          # unitarios e integración
npm run test:e2e  # Playwright: crea sala en PC, entra desde móvil, chat, sync y cesión de control
```

El E2E arranca automáticamente backend y frontend (`webServer` de Playwright). Requiere ejecutar una vez `npm run test:e2e:install`.

---

## Despliegue

### Docker Compose (SQLite persistente)

```bash
cp .env.example .env
# Edita TOKEN_SECRET (obligatorio) y, si hace falta, NEXT_PUBLIC_API_URL
docker compose up --build
```

- Web: `http://localhost:3000`
- API: `http://localhost:4000`
- Datos: volumen `cineduo-data` (`/data/cineduo.db`)

### Manual

```bash
npm ci
npm run build
npm start
```

Sirve la web detrás de HTTPS (requisito para PWA, wake lock y clipboard). Para PostgreSQL, reverse proxy y notas de escalado consulta [`docs/DEPLOY.md`](docs/DEPLOY.md).

---

## Seguridad y límites

- Códigos de sala generados con `crypto.randomInt` sobre alfabeto sin ambigüedades.
- Tokens firmados con HMAC-SHA256 y comparación en tiempo constante; caducan a los 7 días. El rol **no** viaja en el token: se lee de la base de datos.
- Rate limiting en memoria por IP para creación, unión, chat, reacciones, comandos y ping.
- Validación Zod en REST y en cada evento; saneado y límites de longitud para apodos, mensajes y URLs.
- CORS restringido por origen + Helmet; payload JSON máximo 32 kB.
- El service worker **nunca** cachea video, respuestas de API ni tráfico WebSocket.
- Estado activo en memoria y espejo en base de datos con persistencia _debounced_. Esto es intencional para un MVP de un solo proceso; para escalar horizontalmente hace falta un adaptador de Socket.IO y almacenamiento compartido (ver `docs/DEPLOY.md`).

## Aviso legal

CineDúo **no** elude DRM ni sincroniza reproductores internos de plataformas como Netflix, Disney+, HBO Max o Prime Video. Usa únicamente contenido propio, libre o autorizado, y respeta las condiciones de tu proveedor de alojamiento. El video de ejemplo (`apps/web/public/videos/demo.mp4`) es CC0.

## Checklist de aceptación

[`docs/CHECKLIST.md`](docs/CHECKLIST.md)
