# CarePoint Option B - Implementacion V14

## Objetivo

V14 agrega dos release gates operativos para que el rollout hibrido Python no solo tenga contratos, canary y rollback, sino tambien evidencia de capacidad y cobertura de alertas antes de aumentar el porcentaje de trafico.

## Nuevos workloads

### platform.capacity_plan

Ruta Node bridge: `POST /api/hybrid-python/platform/capacity/plan/prepare`

El worker Python evalua metricas agregadas de carga, duracion, backlog, concurrencia y dependencias para estimar si la capacidad actual del pool de workers es suficiente para el siguiente paso de canary. El resultado es advisory: Python no escala infraestructura ni modifica despliegues.

### platform.alert_policy_review

Ruta Node bridge: `POST /api/hybrid-python/platform/alerts/review/prepare`

El worker Python revisa metadatos de alertas y dashboards para verificar cobertura minima de senales: Python down, error rate, p95 latency, queue backlog, shadow mismatch, privacy block y artifact leak. El resultado es advisory: Python no crea monitores ni paginas.

## Ownership preservado

- Node/Express conserva auth, RBAC/ABAC, Prisma, rutas productivas y rollback.
- CI/operadores conservan escalado, despliegue y configuracion de observabilidad.
- Python solo genera reportes sanitizados y artefactos JSON para evidence bundle/change ticket.

## Validacion

```bash
npm run check:secrets --silent
npm run verify:workspace --silent
npm run verify:python-worker --silent
cd services/python-worker && python3 -m pytest -q
```
