# Arquitectura

## Vista general

```
┌────────────────────────┐         REST + Socket.IO         ┌────────────────────────┐
│  Web (Next.js PWA)     │ ───────────────────────────────▶ │  Server (Express + IO) │
│  PC host / móvil guest │ ◀─────────────────────────────── │  fuente de verdad      │
└────────────────────────┘                                  └───────────┬────────────┘
                                                                        │ debounced
                                                                        ▼
                                                            ┌────────────────────────┐
                                                            │ SQLite / PostgreSQL    │
                                                            │ Prisma (espejo durable)│
                                                            └────────────────────────┘
```

- **`packages/shared`** contiene los contratos (tipos de eventos, esquemas Zod) y la matemática pura de sincronización/reloj. Lo consumen cliente y servidor, de modo que un cambio de protocolo rompe la compilación en ambos lados.
- **`apps/server`** es la única autoridad sobre `position`, `isPlaying`, `playbackRate`, `version`, `updatedAt` y `hostId`.
- **`apps/web`** representa ese estado, aplica correcciones al `<video>` y envía comandos solo si el usuario es host.

## Estado autoritativo

`LiveRoom` vive en el mapa en memoria `liveRooms` (`services/roomStore.ts`):

```ts
interface LiveRoom {
  id;
  code;
  createdAt;
  isActive;
  playback: PlaybackState; // position, isPlaying, rate, version, updatedAt, hostId
  participants: Map<string, LiveParticipant>;
  hostGraceTimer;
  persistTimer;
  lastActivityAt;
}
```

- Cada comando del host ejecuta `assertHost` y luego `commit`, que actualiza `updatedAt`, incrementa `version` y programa una persistencia _debounced_.
- La base de datos es un **espejo durable**: permite reconstruir la sala tras reiniciar el proceso y guardar mensajes/eventos. No se consulta en cada comando.
- Si una sala no está en memoria, se hidrata desde Prisma (`GET`, `join`, primer socket), restaurando playback y participantes.

## Por qué hay dos capas de verdad

| Capa    | Ventaja                                                  | Coste                                    |
| ------- | -------------------------------------------------------- | ---------------------------------------- |
| Memoria | Latencia mínima, timers de host y persistencia debounced | Se pierde con el proceso                 |
| Prisma  | Recuperación, historial, auditoría                       | No apto para comandos de alta frecuencia |

Para un MVP de una sola instancia es el equilibrio correcto. `docs/DEPLOY.md` describe qué haría falta para escalar horizontalmente.

## Autenticación

1. `POST /api/rooms` o `/join` crea un `Participant` y devuelve un token.
2. Token = `base64url(payload) + "." + HMAC-SHA256(payload, TOKEN_SECRET)`, con `{ v: 1, pid, rid, iat }`.
3. El cliente guarda el token en `localStorage` por código de sala y lo usa:
   - en el handshake de Socket.IO (`auth.token`),
   - como `Authorization: Bearer` al pedir el historial.
4. El servidor verifica firma, formato, caducidad (7 días), pertenencia a la sala y existencia del participante. **El rol nunca viaja en el token**, así una cesión de host no requiere reemitirlo.
5. Un enlace compartido puede incluir `?t=<token>`; el cliente lo guarda y lo elimina de la URL (`history.replaceState`).

### Superficie de confianza

- Cada evento valida su payload con Zod; los errores se devuelven como `Ack<{ok:false}>` o evento `error`.
- Los comandos de reproducción vuelven a comprobar `hostId` contra el estado vivo, no contra el cliente.
- Los límites de ritmo se aplican por IP (REST) y por socket (eventos).

## Presencia, host y reconexión

- **Join**: REST crea/recupera el participante; Socket.IO lo asocia al `socketId` y emite `room:state`.
- **Reconexión**: mismo token → mismo participante. Se cancela cualquier timer de host, se cierra el socket antiguo y se emite `participant:reconnected` + aviso de sistema.
- **Desconexión del host**: arranca un timer `HOST_DISCONNECT_GRACE_MS` (30 s). Si vuelve, se cancela. Si no, se elige al invitado conectado más antiguo y se emite `host:changed` + `player:sync`.
- **Salida explícita** (`room:leave`): mismo camino, con aviso distinto.
- **Pestañas duplicadas**: el socket anterior del mismo participante se desconecta para que la presencia sea determinista.

## Ciclo de un comando

```
Host pulsa Play
  └─▶ socket.emit('player:play', { position, clientSeq })
        └─▶ handler valida Zod + rate limit + assertHost
              └─▶ commit({ position, isPlaying: true })  // version++
                    ├─▶ io.to(room).emit('player:sync', ...)
                    └─▶ schedulePersist(room)             // debounced
Invitados reciben player:sync → store.applySync (ignora versión ≤ local)
  └─▶ VideoStage.align(): seek duro / rate temporal / nada
```

El host también recibe su propio `player:sync`; lo usa para re-anclar sin autocorregirse (es la referencia).

## Cliente

- **Zustand** (`lib/store.ts`) guarda playback, participantes, chat, reacciones, presencia, estado de conexión y errores.
- **`lib/session.ts`** abre el socket, enlaza eventos y gestiona reconexión, ping/pong y errores fatales.
- **`lib/actions.ts`** centraliza comandos tipados con `clientSeq`.
- **`lib/clock.ts`** mantiene el offset con el servidor.
- **`VideoStage`** contiene el motor de reproducción: heartbeat del host, bucle de reconciliación 1 Hz, buffering, gesto de autoplay y pantalla completa.
- **`lib/player/engine.ts`** abstrae tres motores con la misma interfaz (`currentTime`, `play`, `seek`, `setRate`, `setMuted`): `<video>` nativo (MP4/WebM/HLS con hls.js), YouTube IFrame Player API y Vimeo Player SDK. La sincronización es idéntica; los reproductores incrustados corrigen solo con saltos porque no admiten micro-ajustes de velocidad.
- **`RoomClient`** resuelve token, valida la sala y alterna entre `JoinGate` y `RoomView`.

## PWA

- `public/manifest.webmanifest` + iconos PNG (incluido maskable) y `apple-touch-icon`.
- `public/sw.js` cachea el shell y la página offline; excluye `/api`, `/socket.io` y `/videos`.
- `PwaRegister` solo registra el SW en producción; `InstallPrompt` muestra el flujo nativo (o instrucciones en iOS).
- `useWakeLock` mantiene la pantalla encendida y renueva el bloqueo al volver del segundo plano.

## Decisiones y compromisos

| Decisión                          | Motivo                                                          |
| --------------------------------- | --------------------------------------------------------------- |
| Monorepo con `packages/shared`    | Contratos y matemática idénticos; menos deriva cliente/servidor |
| Socket.IO frente a WebSocket puro | Acks, reconexión, rooms y transporte fallback                   |
| Estado en memoria + espejo Prisma | Latencia y recuperación sin motor externo                       |
| Token opaco sin rol               | La transferencia de host no invalida tokens                     |
| Corrección en 3 niveles           | Evita saltos visibles en desfases pequeños                      |
| Next.js App Router                | PWA, SSR de la portada y despliegue sencillo                    |
| Playwright con dos contextos      | Verifica el caso real PC + móvil, no solo componentes           |

## Estructura de carpetas (detalle)

Ver el árbol en el [`README`](../README.md#estructura). Los puntos de entrada son `apps/server/src/index.ts` (HTTP + Socket.IO) y `apps/web/src/app/page.tsx` / `app/room/[code]/page.tsx`.

## Riesgos conocidos

- Estado en memoria → **una sola instancia** sin trabajo adicional.
- El autoplay móvil exige un gesto; la UI lo resuelve con un overlay explícito.
- HLS depende de CORS del origen del stream.
- SQLite no soporta despliegues multi-réplica; para producción real, usa PostgreSQL.
