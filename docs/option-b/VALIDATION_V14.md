# CarePoint Option B - Validacion V14

## Gates agregados

- `platform.capacity_plan`: estima worker count recomendado, detecta error rate, backlog y dependencias degradadas.
- `platform.alert_policy_review`: valida cobertura minima de alertas y on-call antes de promocion.

## Resultados esperados

- `schemaVersion=2026-05-option-b-v14`.
- 23 vectores de contrato sanitizados.
- Artefactos `platform.capacity_plan.report` y `platform.alert_policy_review.report`.
- Ambos jobs son dry-run-only y advisory.

## Criterio para avanzar canary

No subir canary si capacity plan recomienda `hold` o `rollback`, o si alert policy review devuelve `hold` por senales faltantes. Adjuntar ambos artefactos al evidence bundle y al ticket de cambio.
