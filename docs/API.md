# API REST

Base en desarrollo: `http://localhost:4000`. Todas las rutas cuelgan de `/api`.

## Formato de error

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "El apodo debe tener al menos 2 caracteres",
    "details": [{ "path": ["nickname"], "message": "..." }]
  }
}
```

Códigos: `VALIDATION_ERROR`, `NOT_FOUND`, `ROOM_CLOSED`, `ROOM_FULL`, `FORBIDDEN`, `UNAUTHORIZED`, `RATE_LIMITED`, `CONFLICT`, `INTERNAL_ERROR`.

## Rate limits

Ventana deslizante en memoria por IP:

| Acción             | Límite     |
| ------------------ | ---------- |
| Crear sala         | 10 / hora  |
| Consultar o unirse | 30 / 5 min |
| Chat               | 8 / 10 s   |
| Reacciones         | 6 / 5 s    |
| Comandos de player | 40 / 10 s  |
| Ping               | 60 / 10 s  |

Al superarlo: `429` con `code: "RATE_LIMITED"` y, cuando aplica, `details.retryAfterMs`.

---

## `GET /api/health`

Sin autenticación. Devuelve `200` si la base de datos responde o `503` si está caída.

```json
{
  "status": "ok",
  "uptimeSeconds": 123,
  "database": "up",
  "version": "0.1.0",
  "serverTime": 1763000000000
}
```

---

## `POST /api/rooms`

Crea una sala y devuelve el token del host.

**Body**

```json
{
  "nickname": "Ana",
  "videoUrl": "/videos/demo.mp4"
}
```

- `nickname` 2–24 caracteres, letras/números/espacios/`. _ -`.
- `videoUrl` opcional. Acepta `http(s)://…` o rutas relativas del sitio (`/videos/demo.mp4`). Máx. 2048 caracteres. El servidor detecta el tipo y lo devuelve en `playback.videoType`:
  - `mp4`, `webm`, `hls`: archivo directo (por extensión).
  - `youtube`: cualquier formato (`watch?v=`, `youtu.be/`, `shorts/`, `live/`, `embed/`).
  - `vimeo`: `vimeo.com/{id}` o `player.vimeo.com/video/{id}`, con hash opcional para videos no listados.
  - Los enlaces de plataformas con DRM (Netflix, Disney+, Max, HBO Max, Prime Video) se rechazan con `422` y un mensaje claro.

**Respuesta `201`**

```json
{
  "roomCode": "DEMO24",
  "joinUrl": "http://localhost:3000/room/DEMO24",
  "participantToken": "eyJ2IjoxLCJwaWQiOi….<hmac>",
  "participant": {
    "id": "cmp…",
    "nickname": "Ana",
    "role": "host",
    "isConnected": false,
    "lastSeen": 1763000000000
  },
  "playback": {
    "videoUrl": "/videos/demo.mp4",
    "videoType": "mp4",
    "position": 0,
    "isPlaying": false,
    "playbackRate": 1,
    "updatedAt": 1763000000000,
    "version": 0,
    "hostId": "cmp…"
  }
}
```

Errores: `400 VALIDATION_ERROR`, `429 RATE_LIMITED`.

---

## `GET /api/rooms/:code`

Vista pública para validar una invitación antes de entrar. No requiere token.

```json
{
  "room": { "code": "DEMO24", "createdAt": 1763000000000, "isActive": true },
  "playback": { "…": "PlaybackState" },
  "participants": [
    {
      "id": "cmp…",
      "nickname": "Ana",
      "role": "host",
      "isConnected": true,
      "lastSeen": 1763000000123
    }
  ],
  "serverTime": 1763000000456
}
```

Errores: `400 VALIDATION_ERROR` (código inválido), `404 NOT_FOUND` (no existe o cerrada), `429 RATE_LIMITED`.

---

## `POST /api/rooms/:code/join`

Crea un participante invitado y devuelve su token.

**Body**

```json
{ "nickname": "Leo" }
```

**Respuesta `200`**

```json
{
  "roomCode": "DEMO24",
  "participantToken": "…",
  "participant": {
    "id": "cmp…",
    "nickname": "Leo",
    "role": "guest",
    "isConnected": false,
    "lastSeen": 1763000000000
  },
  "playback": { "…": "PlaybackState" },
  "participants": [{ "…": "Participant" }]
}
```

Errores: `400`, `404`, `409 ROOM_FULL` (límite `MAX_PARTICIPANTS`), `410 ROOM_CLOSED`, `429`.

> El socket reutiliza el participante si se reconecta con el mismo token; para volver a entrar tras perder el token hay que hacer un nuevo `join`.

---

## `GET /api/rooms/:code/messages?limit=100`

Historial de chat, en orden cronológico.

**Header**

```
Authorization: Bearer <participantToken>
```

**Respuesta `200`**

```json
{
  "messages": [
    {
      "id": "cmq…",
      "participantId": "cmp…",
      "nickname": "Ana",
      "text": "¿Empezamos?",
      "createdAt": 1763000000000
    }
  ]
}
```

- `limit` por defecto 100; el servidor acota el resultado.
- El token debe pertenecer a esa sala y a un participante existente.

Errores: `401 UNAUTHORIZED`, `404 NOT_FOUND`, `429`.

---

## CORS y cabeceras

- Orígenes permitidos: `CORS_ORIGINS` (por defecto `http://localhost:3000,http://127.0.0.1:3000`).
- Peticiones sin `Origin` (curl, healthchecks) se permiten.
- Helmet habilita cabeceras de seguridad; `crossOriginResourcePolicy: cross-origin` permite servir recursos de video si en el futuro el backend los aloja.
- Cada respuesta incluye `x-request-id` para correlacionar logs.

## Ejemplo con curl

```bash
curl -s -X POST http://localhost:4000/api/rooms \
  -H "content-type: application/json" \
  -d '{"nickname":"Ana","videoUrl":"/videos/demo.mp4"}'

curl -s http://localhost:4000/api/rooms/DEMO24

curl -s -X POST http://localhost:4000/api/rooms/DEMO24/join \
  -H "content-type: application/json" \
  -d '{"nickname":"Leo"}'
```
