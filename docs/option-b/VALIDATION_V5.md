# Option B - Validacion V5

## Comandos ejecutados

```bash
npm run check:secrets --silent
npm run verify:workspace --silent
npm run verify:python-worker --silent
cd services/python-worker && python3 -m pytest -q
```

## Resultado esperado de esta entrega

- `check:secrets`: OK.
- `verify:workspace`: OK.
- `verify:python-worker`: OK, mensaje `Option B Python worker v5 verification passed.`
- Python tests: `20 passed`.

## Cobertura agregada

V5 agrega tests para:

- Manifest de contratos con `schemaVersion=2026-05-option-b-v5` y `contractHash` estable.
- Test vectors sanitizados para los cinco job types.
- Validacion de contrato sin enqueue ni side effects.
- Bloqueo de payloads con `refreshToken` por policy guard.
- Readiness de rollout con decision `advance` cuando gate y prerequisitos pasan.
- Readiness `hold`/`rollback` cuando faltan prerequisitos productivos.
- Planificacion de rollout canary con stages `[0, 5, 10]`.
- Avance controlado a `currentPercent=5` solo cuando el gate lo permite.
- Assignment deterministico por `subjectKey` con bucket estable.
- Rollback que fuerza `currentPercent=0` y `routeToPython=false`.
- Plan dry-run que no persiste estado.

## Observaciones

No se certifica build TypeScript completo en este entorno si no existe `node_modules`. La V5 actualiza schemas TypeScript y el Node bridge para que CI/dev lo valide con:

```bash
npm ci
npm run build:contracts
npm run build:api
```
