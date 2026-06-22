# Sprint S1 - Build y runtime estable

Fecha: 2026-05-03

## Objetivo

Convertir el baseline saneado de S0 en un backend que pueda compilar, arrancar, responder health checks de forma predecible y validarse automáticamente en CI.

## Cambios implementados

### 1. Scripts de ejecución y verificación

Se añadieron scripts raíz para estandarizar la validación del backend:

- `npm run prisma:generate`
- `npm run smoke:api`
- `npm run smoke:api:ci`
- `npm run verify:s1:config`
- `npm run verify:s1`

`verify:s1` ejecuta saneamiento de secretos, verificación del workspace, validación S1, Prisma generate, build backend y smoke runtime.

### 2. Health checks separados

Se separaron health checks de liveness y readiness:

- `GET /livez`: confirma que el proceso Express está vivo; no depende de base de datos.
- `GET /readyz`: valida dependencias críticas, empezando por PostgreSQL vía Prisma.
- `GET /healthz`: compatibilidad con el endpoint anterior, ahora con payload normalizado.
- `GET /api/health/live`
- `GET /api/health/ready`
- `GET /api/health/dependencies`

Esto evita que despliegues y balanceadores reinicien el contenedor solo porque la base de datos esté temporalmente degradada. Para reinicio de proceso se usa liveness; para recibir tráfico se usa readiness.

### 3. Arranque y apagado del API

`services/api/src/index.ts` ahora exporta `startServer()` y centraliza:

- creación del servidor HTTP;
- inicialización de Socket.IO;
- manejo de errores de servidor;
- cierre ordenado con `SIGTERM` y `SIGINT`;
- cierre explícito de Prisma con `$disconnect()`.

### 4. Timeout de health check de base de datos

`getDatabaseHealth()` ahora usa timeout controlado por:

```env
HEALTH_CHECK_TIMEOUT_MS=2500
```

Esto evita que `/readyz` o `/healthz` queden bloqueados por una conexión lenta o agotada.

### 5. Validación de entorno más estricta

`services/api/src/lib/env.ts` valida ahora:

- puerto TCP válido en `API_PORT`;
- entero positivo en `HEALTH_CHECK_TIMEOUT_MS`;
- URLs HTTP/HTTPS válidas para frontends y CORS;
- secretos inseguros en producción, incluyendo valores locales heredados.

### 6. Respuesta JSON para 404

Las rutas no encontradas ahora pasan por el `errorHandler` centralizado. Esto normaliza la respuesta con:

- `error`;
- `details`;
- `supportReferenceId`;
- `locale`.

### 7. CI S1

`.github/workflows/ci.yml` ahora valida:

1. `npm ci`;
2. `npm run check:secrets`;
3. `npm run verify:workspace`;
4. `npm run verify:s1:config`;
5. `npm run prisma:generate`;
6. `npm run build:backend`;
7. `npm run smoke:api:ci`.

El smoke test CI arranca `services/api/dist/index.js`, espera `/livez` y luego ejecuta el smoke completo.

### 8. Docker healthcheck

`services/api/Dockerfile` incluye healthcheck por `/livez`. El compose de Dokploy también define healthcheck para el API.

## Archivos principales modificados

- `package.json`
- `.env.example`
- `.github/workflows/ci.yml`
- `services/api/src/index.ts`
- `services/api/src/app.ts`
- `services/api/src/lib/env.ts`
- `services/api/src/lib/prisma.ts`
- `services/api/src/modules/health/health.routes.ts`
- `services/api/Dockerfile`
- `deploy/dokploy/docker-compose.dokploy.yml`
- `scripts/s1/smoke-api.mjs`
- `scripts/s1/ci-api-smoke.mjs`
- `scripts/s1/verify-s1-config.mjs`

## Criterios de aceptación S1

S1 se considera aceptado cuando en un entorno con internet y dependencias instalables se cumple:

```bash
npm ci
npm run verify:s1
```

Y el API expone:

```bash
curl http://localhost:4000/livez
curl http://localhost:4000/readyz
curl http://localhost:4000/api/health/live
curl http://localhost:4000/api/health/ready
```

## Límite conocido

En este sandbox no se puede ejecutar `prisma generate` porque Prisma descarga binarios desde internet. Por eso se dejó la validación estructural S1 ejecutada localmente y la validación completa delegada a CI/desarrollo con acceso de red.
