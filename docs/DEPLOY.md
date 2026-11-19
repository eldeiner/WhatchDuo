# Despliegue

## Opción A — Docker Compose (SQLite persistente)

```bash
cp .env.example .env
# Edita como mínimo TOKEN_SECRET
docker compose up --build -d
docker compose logs -f server
```

| Servicio | Puerto | Datos                                       |
| -------- | ------ | ------------------------------------------- |
| `web`    | `3000` | Build standalone de Next.js                 |
| `server` | `4000` | Volumen `cineduo-data` → `/data/cineduo.db` |

El contenedor del servidor ejecuta `prisma migrate deploy` en cada arranque (idempotente) y luego `node dist/index.js`.

### Variables imprescindibles

```env
TOKEN_SECRET=<cadena aleatoria de 32+ bytes>   # openssl rand -hex 32
NEXT_PUBLIC_API_URL=http://localhost:4000       # URL que ve el NAVEGADOR
WEB_ORIGIN=http://localhost:3000
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

> `NEXT_PUBLIC_API_URL` se incrusta en el bundle **en tiempo de build**. Si cambias de dominio, reconstruye la imagen web:
> `docker compose build web --build-arg NEXT_PUBLIC_API_URL=https://api.tudominio.com`

### Probar desde el móvil en la red local

1. Usa la IP de tu PC, p. ej. `http://192.168.1.20:3000`.
2. Reconstruye la web con `NEXT_PUBLIC_API_URL=http://192.168.1.20:4000`.
3. Añade `http://192.168.1.20:3000` a `CORS_ORIGINS` y `WEB_ORIGIN`.

Los enlaces de invitación se construyen con `WEB_ORIGIN`, así que conviene que coincida con la URL real.

---

## Opción B — Proceso manual

```bash
npm ci
npm run build
NODE_ENV=production npm start
```

O por separado:

```bash
npm run start:server   # :4000
npm run start:web      # :3000
```

Requiere una base de datos migrada y `TOKEN_SECRET` seguro. Coloca ambos procesos detrás de un supervisor (systemd, PM2, contenedor) y de HTTPS.

---

## PostgreSQL en producción

El repo incluye el esquema equivalente:

```bash
cd apps/server
cp prisma/schema.postgres.prisma prisma/schema.prisma
export DATABASE_URL="postgresql://cineduo:pass@localhost:5432/cineduo"
npm run db:generate
npm run db:migrate      # genera migración inicial para Postgres
```

- En Docker, añade un servicio `postgres:16-alpine` con volumen y healthcheck, y define `DATABASE_URL` para el servidor.
- Vuelve a ejecutar `prisma generate` al cambiar el proveedor.
- El código no usa SQL específico de SQLite; los modelos son idénticos.

---

## HTTPS y PWA

La PWA, el service worker, `navigator.clipboard` y Screen Wake Lock requieren **contexto seguro**:

- `https://` en producción, o
- `http://localhost` para desarrollo.

Un despliegue en `http://192.168.x.x` funciona para probar el video, pero el navegador no permitirá instalar la PWA ni usar el portapapeles moderno.

### Reverse proxy (Nginx)

```nginx
server {
  listen 443 ssl http2;
  server_name cineduo.example.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /api/ {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /socket.io/ {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
  }
}
```

Con este montaje, en el frontend puedes usar `NEXT_PUBLIC_API_URL=""` para que REST y Socket.IO vayan al mismo origen (`/api`, `/socket.io`) y evitar CORS.

---

## Medios (video)

- El frontend sirve `/videos/demo.mp4` (CC0).
- Para contenido propio puedes:
  - servirlo desde el mismo dominio (ruta en `public/`),
  - o usar una URL externa con **CORS abierto** para `GET`/`HEAD` y cabeceras `Range`.
- HLS necesita el `.m3u8` y los segmentos accesibles por CORS; hls.js los pide desde el navegador.
- El backend no proxya ni almacena el video: guarda solo la URL.
- YouTube y Vimeo se reproducen mediante sus reproductores oficiales incrustados (`youtube-nocookie.com` e IFrame API / Player SDK de Vimeo). No requieren CORS, pero sí conexión a internet y que el video permita la incrustación. La app no descarga ni proxya su contenido.
- Las plataformas con DRM (Netflix, Disney+, Max, Prime Video…) se rechazan con un aviso claro: no se pueden incrustar ni reproducir sin eludir protecciones.
- **No** se soportan DRM ni reproductores embebidos de plataformas protegidas.

---

## Escalado y alta disponibilidad

El MVP mantiene las salas activas en memoria del proceso. Consecuencias:

- Ejecuta **una sola instancia** del backend.
- Si el proceso se reinicia, las salas se hidratan de la base de datos al primer acceso, pero los sockets deben reconectar.
- Los timers de host y el rate limiting son locales.

Para escalar horizontalmente haría falta:

1. Adaptador de Socket.IO (Redis) con `@socket.io/redis-adapter`.
2. Estado de sala compartido (Redis) o _sticky sessions_ + una única fuente de verdad.
3. Rate limiting distribuido.
4. Cola/observador para cierres de sala.

No es necesario para el alcance del MVP, pero está documentado para no prometer lo que no hay.

---

## Backups

- SQLite: copia el volumen (`/data/cineduo.db`) con la aplicación parada, o usa `sqlite3 .backup`.
- PostgreSQL: `pg_dump` programado.
- Los mensajes y eventos son lo único irrecuperable; el video no se almacena.

---

## Operación

- `GET /api/health` devuelve `503` si la base de datos no responde (útil para orquestadores).
- Logs JSON con `requestId` (HTTP) y eventos de sala (Socket.IO).
- Cierre ordenado con `SIGINT`/`SIGTERM`: persiste salas activas, cierra Socket.IO y HTTP, desconecta Prisma.
- `TOKEN_SECRET` de ejemplo se rechaza en `NODE_ENV=production`.
- CORS con `localhost` en producción genera un warning en logs.

## Solución de problemas

| Síntoma                               | Causa probable                                          |
| ------------------------------------- | ------------------------------------------------------- |
| «No se pudo conectar con el servidor» | `NEXT_PUBLIC_API_URL` incorrecta o servidor caído       |
| CORS bloqueado                        | Origen no incluido en `CORS_ORIGINS`                    |
| Socket conecta y desconecta           | Proxy sin `Upgrade`/`Connection: upgrade`               |
| El invitado no reproduce              | Autoplay bloqueado: pulsar el overlay de gesto          |
| HLS no carga                          | CORS o Content-Type del `.m3u8`/segmentos               |
| PWA no instalable                     | Falta HTTPS o manifest/iconos inaccesibles              |
| «Token inválido» tras cambiar secreto | Los tokens antiguos dejan de verificar; vuelve a entrar |
