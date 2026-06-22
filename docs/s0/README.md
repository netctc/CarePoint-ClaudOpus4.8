# Sprint S0 - Implementación de estabilización inicial

S0 prepara el repositorio para implementar las fases posteriores con menos riesgo. Esta iteración no introduce nuevas funcionalidades de negocio; corrige la base operacional del monorepo.

## Cambios realizados

1. Saneamiento de secretos: eliminado `services/api/.env`, actualizados `.env.example`, y añadido `npm run check:secrets`.
2. Higiene de repositorio: eliminados ZIPs, `.old`, copias y runtime JSON; reforzados `.gitignore` y `.dockerignore`.
3. Baseline de workspace: añadido `npm run verify:workspace`, fijado `packageManager`, y corregido orden de build `contracts -> api -> web`.
4. Seguridad mínima: rechazo de secretos débiles en producción, `MEDICAL_PROFILE_ENCRYPTION_KEY` centralizada, y Socket.IO usando `FRONTEND_ALLOWED_ORIGINS`.
5. CI mínimo: `.github/workflows/ci.yml` con PostgreSQL, Redis, `npm ci`, checks S0, Prisma generate y build backend.
6. Smoke tests: `npm run smoke:api` para `/healthz`, `/api/health` y `/api/health/dependencies`.

## Comandos

```bash
cp .env.example .env.local
npm ci --no-audit --no-fund
npm run prisma:generate --workspace @care-center/api
npm run verify:s0
npm run dev:api
npm run smoke:api
```

## Rotación obligatoria fuera del repositorio

Los secretos encontrados en el paquete original deben considerarse comprometidos. Antes de desplegar, rotar credenciales de base de datos, JWT access/refresh y clave de cifrado médico.
