# Algoritmo de sincronización

El objetivo es que dos dispositivos con relojes distintos y redes distintas muestren el mismo segundo del video. El servidor no reproduce video: mantiene un **reloj de reproducción** y los clientes lo siguen.

## 1. Modelo de estado

```ts
interface PlaybackState {
  position: number; // segundos, válida en updatedAt
  isPlaying: boolean;
  playbackRate: 0.75 | 1 | 1.25 | 1.5;
  updatedAt: number; // epoch ms del servidor
  version: number; // monótona creciente
  hostId: string;
  videoUrl: string | null;
  videoType: 'mp4' | 'webm' | 'hls' | 'youtube' | 'vimeo';
}
```

## 2. Reloj cliente ↔ servidor (NTP simplificado)

El cliente envía `ping { clientTime: t0 }`. El servidor responde `pong { clientTime: t0, serverTime: ts, protocol }` y el cliente mide `t1 = Date.now()`.

```
RTT      = t1 − t0
offset   = ts − (t0 + t1) / 2      // se asume simetría del camino
```

- Se recogen **5 muestras** al conectar (~280 ms de separación) y se conservan las 5 mejores de la sesión.
- El offset final es la **mediana** de las 3 muestras con menor RTT (`estimateOffset` en `packages/shared/src/clock.ts`).
- `clock.now()` devuelve la hora estimada del servidor: `Date.now() + offset`.
- Mientras no hay muestras, se usa el `serverTime` del último snapshot como _hint_.
- Hay un ping de mantenimiento cada 20 s para corregir deriva.

La mediana evita que un pico puntual de red desplace el reloj; elegir las de menor RTT reduce el error de asimetría.

## 3. Posición esperada

```ts
function expectedPosition(state, serverNow) {
  if (!state.isPlaying) return state.position;
  const elapsed = Math.max(0, serverNow - state.updatedAt) / 1000;
  return state.position + elapsed * Math.max(0, state.playbackRate);
}
```

`updatedAt` siempre lo genera el servidor. Si llegara del futuro (reloj movido), `elapsed` se satura a 0 para no retroceder.

## 4. Niveles de corrección

`decideCorrection()` es una función pura y testeada:

| Desfase `|drift|` | Estado | Acción |
| --- | --- | --- |
| `> 0,1 s` | Pausado | `seek` exacto a `expected` |
| `≥ 0,75 s` | Reproduciendo | `seek` directo a `expected` |
| `0,3 – 0,75 s` | Reproduciendo | `playbackRate = base × 0,95/1,05` durante **2 s** |
| `< 0,3 s` | Reproduciendo | Nada |

`drift = currentTime − expected`: positivo significa que el cliente va **por delante**.

El micro-ajuste de velocidad evita el “salto” visible de un seek. Tras 2 s se restaura la velocidad nominal, salvo que el host la haya cambiado.

> **YouTube y Vimeo** no exponen un ajuste fino de velocidad fiable y su reloj interno no es continuo. En esos casos no se usa el nivel intermedio: si la deriva supera `0,3 s` se hace un `seek` correctivo, y el resto del tiempo se considera sincronizado. El host sigue siendo la referencia y el heartbeat re-ancla el estado cada 4 s.

## 5. Bucle del cliente

`VideoStage` ejecuta dos bucles distintos:

- **Reacción a versión**: cada `player:sync` aceptado aplica inmediatamente el nuevo estado (`align(state, hard = true)`).
- **Reconciliación 1 Hz**: recalcula `expected` y aplica la corrección suave. También detecta `readyState < 3` para mostrar _buffering_.

Reglas:

- **El host no se autocorrige.** Su video es la referencia; envía heartbeats.
- `applySync` descarta `incoming.version <= local.version`, lo que filtra ecos, mensajes duplicados y estados viejos tras reconectar.
- Si el navegador bloquea el autoplay, se muestra un overlay; al tocarlo se calcula `expected` y se hace `play()` dentro del gesto.

## 6. Heartbeat del host

Cada **4 s** el host emite:

```ts
player:heartbeat { position, isPlaying, clientTime, clientSeq }
```

El servidor compara la posición real con la predicha:

```ts
predicted = expectedPosition(room.playback, now)
drift     = clamp(position) − predicted
```

- Si `|drift| ≤ 0,4 s` y `isPlaying` coincide → no hace nada (no incrementa versión, no satura la red).
- Si no → re-ancla `position`/`isPlaying`, incrementa `version` y emite `player:sync` con `reason: 'heartbeat'`.

Esto cubre buffering largo, pestañas en segundo plano y cambios de red sin obligar al host a mandar comandos.

## 7. Conexión con comandos y versiones

| Acción                                 | Versión    | `updatedAt` |
| -------------------------------------- | ---------- | ----------- |
| play / pause / seek / rate / set-video | +1         | ahora       |
| heartbeat dentro de tolerancia         | sin cambio | sin cambio  |
| heartbeat fuera de tolerancia          | +1         | ahora       |
| transferencia de host                  | +1         | ahora       |

La versión es la barrera de orden: el cliente nunca aplica un estado más antiguo que el que ya tiene, aunque llegue por un canal distinto tras una reconexión.

## 8. Casos límite

- **Pausa**: se alinea con tolerancia estricta (0,1 s), sin ajuste de velocidad.
- **Cambio de velocidad**: el servidor re-ancla `position` en el instante del cambio para que `expected` siga siendo correcto.
- **Cambio de video**: se resetea posición, pausa, velocidad 1 y se incrementa versión; cada cliente recarga la fuente.
- **Fin del video**: el host emite `pause` en `duration`; los invitados alinean al final.
- **Buffer del invitado**: se muestra “Cargando…” y se avisa al host con `player:buffering`; al recuperarse, la corrección lo devuelve a la posición esperada.
- **Pestaña oculta**: el navegador puede frenar timers; el heartbeat del host y la reconciliación al volver corrigen la deriva.
- **Reconexión**: `room:state` trae la versión actual; si es mayor, se aplica con seek duro.

## 9. Parámetros

Todos en `packages/shared/src/constants.ts` (`SYNC`):

```ts
hardSeekThreshold: 0.75,
softSyncThreshold: 0.3,
softRateUp: 1.05,
softRateDown: 0.95,
softSyncDurationMs: 2000,
pausedTolerance: 0.1,
heartbeatIntervalMs: 4000,
heartbeatTolerance: 0.4,
clockSampleCount: 5,
hostDisconnectGraceMs: 30_000,
```

## 10. Tests

- `packages/shared/src/sync.test.ts`: fórmula, umbrales, clamp, versiones.
- `packages/shared/src/clock.test.ts`: mediana, RTT, formato de tiempo.
- `apps/server/test/integration.test.ts`: heartbeat que re-ancla, heartbeat de invitado ignorado, sincronía por WebSocket.
- `e2e/room.spec.ts`: dos navegadores, play del host y comparación de `currentTime` con tolerancia.
