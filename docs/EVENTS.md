# Contratos Socket.IO

- URL: la de `NEXT_PUBLIC_API_URL` (o el mismo origen si está vacío).
- Path: `/socket.io`.
- Transportes: `websocket` con fallback a `polling`.
- Autenticación: `io(url, { auth: { token } })`. El token se envía también en `room:join` (`payload.token`) por compatibilidad.
- Formato de ack:

```ts
type Ack<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string; details?: unknown } };
```

Cada error de comando se emite además como evento `error` (`{ code, message, request? }`), de modo que la UI puede mostrarlo aunque no haya ack.

Límites por socket: comandos 40/10 s, chat 8/10 s, reacciones 6/5 s, ping 60/10 s. Al superarlos se responde `RATE_LIMITED`.

---

## Cliente → servidor

### Sala

| Evento        | Payload                       | Ack                  | Permiso                       |
| ------------- | ----------------------------- | -------------------- | ----------------------------- |
| `room:create` | `{ nickname, videoUrl? }`     | `CreateRoomResponse` | Anónimo (una sala por socket) |
| `room:join`   | `{ code, nickname?, token? }` | `RoomStateEvent`     | Anónimo con token o apodo     |
| `room:leave`  | —                             | `{ left: true }`     | Participante de una sala      |

> La web usa REST para crear/unirse y Socket.IO para `room:join` con el token. `room:create` existe para clientes que quieran hacer todo por socket.

### Reproducción (solo host)

| Evento             | Payload                                          | Ack             | Efecto                         |
| ------------------ | ------------------------------------------------ | --------------- | ------------------------------ |
| `player:play`      | `{ position, clientSeq }`                        | `PlaybackState` | `isPlaying = true`, versión++  |
| `player:pause`     | `{ position, clientSeq }`                        | `PlaybackState` | `isPlaying = false`            |
| `player:seek`      | `{ position, clientSeq }`                        | `PlaybackState` | Re-ancla posición              |
| `player:rate`      | `{ rate, position?, clientSeq }`                 | `PlaybackState` | Cambia 0.75/1/1.25/1.5         |
| `player:set-video` | `{ videoUrl, videoType?, clientSeq }`            | `PlaybackState` | Nuevo video, posición 0, pausa |
| `player:heartbeat` | `{ position, isPlaying, clientTime, clientSeq }` | —               | Re-ancla si drift > 0,4 s      |

`clientSeq` es un contador monótono del cliente para diagnóstico; el servidor no reordena por él (la autoridad es `version`).

### Presencia y chat

| Evento             | Payload                     | Ack                 | Permiso              |
| ------------------ | --------------------------- | ------------------- | -------------------- |
| `chat:send`        | `{ text }` (1–500)          | `ChatMessage`       | Participante         |
| `chat:reaction`    | `{ emoji }` (lista cerrada) | —                   | Participante         |
| `player:buffering` | `{ isBuffering }`           | —                   | Participante         |
| `ping`             | `{ clientTime }`            | — (responde `pong`) | Cualquiera conectado |

### Host

| Evento          | Payload                   | Ack                   | Permiso                                          |
| --------------- | ------------------------- | --------------------- | ------------------------------------------------ |
| `host:transfer` | `{ targetParticipantId }` | `PlaybackState`       | **Solo host**                                    |
| `host:request`  | —                         | `{ requested: true }` | Invitado; reenvía `peer:request-control` al host |

Errores típicos: `FORBIDDEN` (no eres host), `CONFLICT` (host desconectado), `VALIDATION_ERROR` (payload inválido), `NOT_FOUND` (sala o participante).

### WebRTC (fuera del MVP)

| Evento          | Payload              | Notas                                   |
| --------------- | -------------------- | --------------------------------------- |
| `webrtc:signal` | `{ targetId, data }` | Relay tipado; la UI no lo usa en el MVP |

---

## Servidor → cliente

| Evento                    | Payload                                    | Cuándo                                            |
| ------------------------- | ------------------------------------------ | ------------------------------------------------- |
| `room:state`              | `RoomStateEvent`                           | Join, reconexión, cambio de host, cambio de video |
| `room:closed`             | `{ code, reason }`                         | Sala cerrada/sweep (el cliente limpia el token)   |
| `participant:joined`      | `{ participant, serverTime }`              | Nuevo participante                                |
| `participant:reconnected` | `{ participant, serverTime }`              | Mismo participante vuelve                         |
| `participant:left`        | `{ participantId, nickname, serverTime }`  | Desconexión o salida                              |
| `player:sync`             | `PlayerSyncEvent`                          | Comando, heartbeat corregido, host o video        |
| `player:command`          | `PlayerCommandEvent`                       | Notificación semántica del comando                |
| `chat:message`            | `{ message }`                              | Mensaje nuevo (incluye al emisor)                 |
| `chat:system`             | `{ notice }`                               | Entradas, salidas, transferencias                 |
| `chat:reaction`           | `{ reaction }`                             | Reacción efímera                                  |
| `host:changed`            | `{ hostId, by }`                           | `transfer`, `timeout` o `disconnect`              |
| `peer:request-control`    | `{ participantId, nickname }`              | Al host cuando un invitado pide control           |
| `peer:buffering`          | `{ participantId, nickname, isBuffering }` | Aviso de buffering de otro participante           |
| `pong`                    | `{ clientTime, serverTime, protocol }`     | Respuesta a `ping`                                |
| `error`                   | `{ code, message, request? }`              | Cualquier fallo de comando/validación             |

`player:sync`:

```ts
{
  position, isPlaying, playbackRate,
  updatedAt, version, serverTime,
  by,                       // participantId que originó el cambio
  reason: 'command' | 'heartbeat' | 'host' | 'video'
}
```

`room:state`:

```ts
{
  room: { code, createdAt, isActive },
  playback: PlaybackState,
  participants: Participant[],
  serverTime
}
```

---

## Matriz de permisos

| Acción                                 | Host            | Invitado       |
| -------------------------------------- | --------------- | -------------- |
| Ver estado / chat / reacciones         | ✅              | ✅             |
| play / pause / seek / rate / set-video | ✅              | ❌ `FORBIDDEN` |
| heartbeat                              | ✅ (procesado)  | ❌ (ignorado)  |
| transferir host                        | ✅              | ❌             |
| pedir control                          | ❌ (ya es host) | ✅             |
| buffering / ping                       | ✅              | ✅             |

El servidor valida el rol contra `room.playback.hostId` y el participante autenticado, nunca contra datos enviados por el cliente.

---

## Secuencias

### Entrar y reproducir

```
Cliente                         Servidor
  │  POST /api/rooms/:code/join    │  crea/recupera Participant
  │◀──────── token ───────────────│
  │  socket(auth.token)            │
  │  room:join { code }            │  verifica token, adjunta socket
  │◀──── room:state ───────────────│
  │  ping ×5                       │
  │◀──── pong ×5 ──────────────────│  offset = mediana
Host:
  │  player:play { position }      │  assertHost, version++
  │◀──── player:sync ──────────────│  (a todos, incluido host)
Guest:
  │  compara currentTime vs expected
  │  seek / rate ±5% / nada
```

### Transferencia y timeout

1. Host emite `host:transfer` → servidor actualiza `hostId`, `version++`, emite `host:changed`, `room:state`, `player:sync` y aviso de chat.
2. Si el host se desconecta, se arranca el grace timer. Al expirar, se promueve al invitado conectado más antiguo y se emiten los mismos eventos con `by: 'timeout'`.
3. Si el host vuelve antes, se cancela el timer y se emite `participant:reconnected`.

### Reconexión del cliente

```
socket disconnect ─▶ UI “Reconectando…”
socket reconnect ──▶ room:join { code, token }
                  ◀── room:state (versión actual)
                  ──▶ si version > local: seek duro a expected
```
