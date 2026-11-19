# Checklist de aceptación

## Automatizado

- [x] `npm run typecheck` sin errores en shared, server y web.
- [x] `npm test` — 33 tests de shared + 30 de server.
  - [x] Schemas y detección de tipo de video.
  - [x] Fórmula de posición, umbrales de corrección, versiones y clamp.
  - [x] Reloj: mediana, RTT y formato.
  - [x] REST: crear, consultar, unirse, mensajes, health.
  - [x] Permisos: solo el host reproduce/pausa/busca/cambia velocidad.
  - [x] Heartbeat: re-ancla al host y se ignora al invitado.
  - [x] Chat, reacciones, presencia, buffering y ping.
  - [x] Transferencia de host y reconexión con token.
  - [x] Promoción automática tras el grace period.
- [x] `npm run build` — Next.js compila y genera standalone.
- [x] `npm run test:e2e` — Playwright (Chromium):
  - [x] Crear sala en PC con video de ejemplo.
  - [x] Entrar desde contexto móvil (390×844, touch).
  - [x] Presencia y chat bidireccional.
  - [x] Controles deshabilitados para el invitado.
  - [x] Play del host y `currentTime` de ambos dentro de 1,2 s.
  - [x] Cesión de control; el invitado pasa a poder controlar.
  - [x] Recarga del móvil conserva token e historial, sin volver al gate.
  - [x] Código inexistente muestra error claro.

Resultado local: **3/3 E2E, 63 tests unitarios/integración**.

## Manual (recomendado antes de publicar)

### Salas y acceso

- [ ] Crear sala desde la portada con y sin URL de video.
- [ ] Copiar enlace y abrirlo en otro navegador/dispositivo.
- [ ] Verificar que el código es de 6 caracteres y no ambiguo.
- [ ] Intentar entrar con apodo de 1 carácter → error.
- [ ] Intentar entrar a una sala llena → mensaje `ROOM_FULL`.
- [ ] Recargar el invitado → no pide apodo de nuevo.

### Sincronía

- [ ] Play/pausa del host se refleja en el móvil en < 1 s.
- [ ] Seek del host: el invitado salta a la posición.
- [ ] Cambio de velocidad 0,75× / 1,25× / 1,5× coherente.
- [ ] Dejar el móvil bloqueado 30 s y volver → se recoloca.
- [ ] Simular red lenta (DevTools → Slow 3G) → badge «Corrigiendo…» y recuperación.
- [ ] Host en pestaña de fondo → al volver, heartbeat re-ancla.
- [ ] Video pausado: ambos fotogramas coinciden.

### Host y presencia

- [ ] Pedir control desde el invitado → aparece modal en el host.
- [ ] Ceder control → el invitado manda y el host pasa a invitado.
- [ ] Cerrar la pestaña del host → aviso; a los 30 s se promueve al invitado.
- [ ] Volver antes de 30 s → no se promueve y se cancela el aviso.
- [ ] Abrir la misma sala en dos pestañas del mismo perfil → solo una conexión activa por participante.

### Chat y reacciones

- [ ] Mensaje de ida y vuelta con apodo y hora.
- [ ] Reacciones flotantes visibles en ambos lados.
- [ ] Avisos de sistema al entrar/salir/transferir.
- [ ] Enviar >500 caracteres → recortado/validado.
- [ ] Enviar mensajes rápido → rate limit visible, sin romper la sala.

### PWA y móvil

- [ ] Instalar desde Chrome Android / Añadir a inicio en iOS.
- [ ] Abrir en modo standalone (sin barra del navegador).
- [ ] Safe areas respetadas en notch y barra inferior.
- [ ] Pantalla no se apaga durante la reproducción (wake lock).
- [ ] Service worker no cachea `/videos`, `/api` ni `/socket.io`.
- [ ] Página `/offline` visible sin red tras una visita.
- [ ] Rotar a horizontal y usar pantalla completa.

### Seguridad y robustez

- [ ] CORS rechaza orígenes no listados.
- [ ] Token manipulado → `UNAUTHORIZED` y vuelta al gate.
- [ ] Invitado intenta `player:play` por consola → `FORBIDDEN`.
- [ ] URL `javascript:` o `file://` rechazada por Zod.
- [ ] Reiniciar el servidor → las salas se hidratan y los clientes reconectan.
- [ ] `TOKEN_SECRET` por defecto falla con `NODE_ENV=production`.

### Accesibilidad

- [ ] Navegación completa con Tab y foco visible.
- [ ] Modal atrapa el foco, cierra con Escape y lo restaura.
- [ ] Botones con `aria-label` y estados `aria-pressed`/`aria-selected`.
- [ ] Chat con `role="log"` y `aria-live="polite"`.
- [ ] Contraste legible en texto principal y controles.
- [ ] `prefers-reduced-motion` desactiva animaciones.

### Legal

- [ ] El README y la UI advierten del uso de contenido propio/autorizado.
- [ ] No hay funciones de elusión de DRM ni integración con plataformas protegidas.
