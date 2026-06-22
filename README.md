# Care Center Platform

Monorepo layout created by the normalization bootstrap.

## Apps
- `apps/admin` - company administration portal (Next.js)
- `apps/provider` - healthcare provider portal (Next.js)
- `apps/mobile` - patient mobile app (Flutter)

## Services
- `services/api` - backend API (created by later bootstrap steps)

## Packages
- `packages/contracts` - shared TypeScript contracts (created by later bootstrap steps)

## S0 - Arranque seguro del monorepo

```bash
cp .env.example .env.local
npm ci --no-audit --no-fund
npm run prisma:generate --workspace @care-center/api
npm run verify:s0
npm run dev:api
npm run smoke:api
```

Notas de S0:

- No se deben commitear archivos `.env`; usar `.env.local` solo en desarrollo.
- Los secretos detectados en paquetes previos deben rotarse en el proveedor correspondiente antes de cualquier despliegue.
- Ver detalles en `docs/s0/README.md`.

## Sprint S1 - Build y runtime estable

S1 añade health checks separados, smoke tests runtime y CI backend:

```bash
npm ci
npm run verify:s1
```

Endpoints operativos mínimos:

- `GET /livez` - liveness sin dependencia de base de datos.
- `GET /readyz` - readiness con validación de PostgreSQL/Prisma.
- `GET /api/health/live`
- `GET /api/health/ready`

Documentación: `docs/s1/S1_IMPLEMENTATION.md` y `docs/s1/S1_VALIDATION.md`.

