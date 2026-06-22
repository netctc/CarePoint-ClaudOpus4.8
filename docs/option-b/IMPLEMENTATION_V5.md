# Option B - Implementacion V5: contratos ejecutables y readiness de rollout

## Objetivo

V5 convierte el control plane de V4 en un flujo mas gobernable para migrar dominios por contrato. La API Node sigue siendo el gateway principal de autenticacion, RBAC/ABAC, object scope, Prisma writes y ownership funcional. Python queda como runtime progresivo para workers, export preparation, analitica, previews no diagnosticos, comparacion shadow y evidencia de canary.

## Cambios principales

### 1. Contract manifest versionado

Nuevo endpoint Python:

- `GET /api/v1/contracts/manifest`

Nuevo endpoint Node bridge:

- `GET /api/hybrid-python/contracts/manifest`

El manifiesto publica:

- `schemaVersion`: `2026-05-option-b-v5`
- `contractHash`: SHA-256 estable del manifiesto y test vectors.
- Contratos por job type: owner, ruta Node, ruta Python, stage, limite maximo de canary, clasificacion de datos, safeguards, acceptance checks y rollback.

### 2. Test vectors contract-first

Nuevo endpoint Python:

- `GET /api/v1/contracts/test-vectors`

Nuevo endpoint Node bridge:

- `GET /api/hybrid-python/contracts/test-vectors`

Cada vector es un `JobEnvelope` minimizado y sanitizado. Sirve para validar que Node y Python comparten contrato antes de activar shadow/canary. No contiene tokens, secretos ni PHI de alto riesgo.

### 3. Validacion de contrato sin enqueue

Nuevo endpoint Python:

- `POST /api/v1/contracts/validate`

Nuevo endpoint Node bridge:

- `POST /api/hybrid-python/contracts/validate`

La validacion ejecuta policy checks y reglas basicas del contrato sin encolar ni escribir estado de job. Esto permite bloquear payloads con secretos, campos PHI no permitidos o non-dry-run en contratos dry-run-only antes de generar side effects.

### 4. Rollout readiness report

Nuevo endpoint Python:

- `GET /api/v1/rollout/readiness`

Nuevo endpoint Node bridge:

- `GET /api/hybrid-python/rollout/readiness`

El reporte combina:

- `canary/gate` de V4.
- Limite maximo de canary del contrato.
- Estado de firma HMAC del bridge.
- Recomendacion de siguiente porcentaje (`nextCanaryPercent`).
- Checklist de prerequisitos y rollback.

Decisiones posibles:

- `advance`: subir al siguiente stage permitido.
- `hold`: no avanzar; falta evidencia o prerequisito.
- `rollback`: mismatch o fallos exceden umbrales.

### 5. Contratos TypeScript actualizados

`packages/contracts/src/index.ts` agrega schemas y tipos:

- `hybridPythonContractCapabilitySchema`
- `hybridPythonContractManifestSchema`
- `hybridPythonContractTestVectorSchema`
- `hybridPythonContractValidationReportSchema`
- `hybridPythonRolloutReadinessQuerySchema`
- `hybridPythonRolloutReadinessReportSchema`

### 6. Bridge Node actualizado

`services/api/src/lib/hybrid-python.ts` agrega:

- `getHybridPythonContractManifest`
- `getHybridPythonContractTestVectors`
- `validateHybridPythonContract`
- `getHybridPythonRolloutReadiness`

`services/api/src/modules/hybrid-python/hybrid-python.routes.ts` expone las rutas bridge con auth/RBAC ya existentes.

## Flujo recomendado para promocionar un dominio

1. Consultar `GET /api/hybrid-python/contracts/manifest` y registrar `contractHash` en el release note.
2. Ejecutar `GET /api/hybrid-python/contracts/test-vectors` y validar que Node pueda construir envelopes equivalentes.
3. Validar payloads reales con `POST /api/hybrid-python/contracts/validate` antes de shadow.
4. Registrar comparaciones en `POST /api/hybrid-python/shadow/comparisons`.
5. Consultar `GET /api/hybrid-python/rollout/readiness?jobType=analytics.snapshot&currentCanaryPercent=0&targetCanaryPercent=5&minComparisons=10`.
6. Avanzar solo si `decision=advance`; si `hold`, recolectar mas evidencia; si `rollback`, poner `HYBRID_PYTHON_CANARY_PERCENT=0`.

## Limitaciones

- V5 no transfiere ownership de tablas a Python.
- V5 no habilita envios reales de notificaciones desde Python.
- V5 no habilita IA clinica diagnostica.
- La build TypeScript completa debe validarse en CI/dev con `npm ci`, porque el entorno de empaquetado puede no tener `node_modules`.

## Extension V5.1: rollout controller con estado y assignment deterministico

Esta continuacion de V5 agrega el primer controlador operativo para subir canary sin depender solo de variables globales.

Nuevos endpoints Python:

- `GET /api/v1/canary/rollout`
- `POST /api/v1/canary/rollout/plan`
- `POST /api/v1/canary/rollout/advance`
- `POST /api/v1/canary/rollout/pause`
- `POST /api/v1/canary/rollout/resume`
- `POST /api/v1/canary/rollout/rollback`
- `POST /api/v1/canary/assignment`
- `GET /api/v1/canary/rollout/audit`

Nuevos endpoints Node bridge:

- `GET /api/hybrid-python/canary/rollout`
- `POST /api/hybrid-python/canary/rollout/plan`
- `POST /api/hybrid-python/canary/rollout/advance`
- `POST /api/hybrid-python/canary/rollout/pause`
- `POST /api/hybrid-python/canary/rollout/resume`
- `POST /api/hybrid-python/canary/rollout/rollback`
- `POST /api/hybrid-python/canary/assignment`

El assignment usa un bucket estable derivado de `sha256(route:subjectKey)`. Esto permite que un mismo sujeto quede consistentemente dentro o fuera del porcentaje canary mientras el porcentaje no cambie. El rollback deja `currentPercent=0`, status `rollback` y fuerza `routeToPython=false` para nuevos assignments.

El estado del rollout se persiste en `PYTHON_WORKER_ROLLOUT_STATE_PATH` y se monta en Compose bajo `/state/rollout-state.json` para que API y worker conserven el historial durante reinicios locales/staging.

Nuevos contratos TypeScript:

- `hybridPythonCanaryRolloutPlanSchema`
- `hybridPythonCanaryRolloutActionSchema`
- `hybridPythonCanaryRolloutStateSchema`
- `hybridPythonCanaryAssignmentRequestSchema`
- `hybridPythonCanaryAssignmentSchema`

### Promocion segura con el controlador

1. Ejecutar shadow comparisons y verificar `GET /api/hybrid-python/canary/gate`.
2. Crear un plan dry-run con `POST /api/hybrid-python/canary/rollout/plan` y `dryRun=true`.
3. Confirmar el plan con `dryRun=false` cuando los prerequisitos pasen.
4. Ejecutar `POST /api/hybrid-python/canary/rollout/advance` con `dryRun=false` solo si el gate permite avanzar.
5. Usar `POST /api/hybrid-python/canary/assignment` para previsualizar rutas por `subjectKey` antes de activar trafico real.
6. Ejecutar rollback con `POST /api/hybrid-python/canary/rollout/rollback` si el gate recomienda `rollback` o si observabilidad productiva detecta degradacion.
