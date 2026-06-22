# CarePoint Option B - Implementacion V15

## Objetivo

V15 agrega dos gates finales de preparacion operativa antes de aumentar canary: readiness de dependencias y readiness de produccion. Ambos son dry-run/advisory y trabajan solo con metadatos sanitizados.

## Nuevos workloads

### platform.dependency_readiness

Ruta Node bridge: `POST /api/hybrid-python/platform/dependencies/readiness/prepare`

Evalua evidencias de salud de dependencias como Python worker, Node API, Redis, artifact store u otros componentes declarados por release. Devuelve `pass`, `hold` o `rollback` segun dependencias faltantes, degradadas o criticas.

### platform.production_readiness

Ruta Node bridge: `POST /api/hybrid-python/platform/production/readiness/prepare`

Agrega evidencias sanitizadas de contract replay, privacy preflight, SLO regression, capacity plan, alert policy review, dependency readiness y rollback drill. Produce una decision final `advance`, `hold` o `rollback` para adjuntar al change ticket.

## Ownership preservado

- Node/Express conserva API, auth, RBAC/ABAC, Prisma, trafico productivo y mutaciones.
- CI/operadores conservan deployment, escalado, alertas, rollback y cambio de trafico.
- Python solo produce reportes sanitizados y artefactos JSON.

## Validacion

```bash
npm run check:secrets --silent
npm run verify:workspace --silent
npm run verify:python-worker --silent
cd services/python-worker && python3 -m pytest -q
```
