# syntax=docker/dockerfile:1

# Contexto de build: la raíz del monorepo (ver docker-compose.yml).
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/server apps/server

RUN npm run build -w @cineduo/shared \
  && npm run db:generate -w @cineduo/server \
  && npm run build -w @cineduo/server

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/server/package.json ./apps/server/package.json
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/server/prisma ./apps/server/prisma

WORKDIR /app/apps/server
EXPOSE 4000

# `migrate deploy` es idempotente: aplica migraciones pendientes al arrancar.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
