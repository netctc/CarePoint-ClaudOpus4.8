# CarePoint Option B - Validacion V15

## Gates agregados

- `platform.dependency_readiness`: valida dependencias requeridas y estado critico con metadatos operativos.
- `platform.production_readiness`: consolida evidencias de release/canary para una decision final de promocion.

## Resultados esperados

- `schemaVersion=2026-05-option-b-v15`.
- 25 vectores de contrato sanitizados.
- Artefactos `platform.dependency_readiness.report` y `platform.production_readiness.report`.
- Ambos jobs son dry-run-only y advisory.

## Criterio para avanzar canary

No aumentar canary si dependency readiness devuelve `hold` o `rollback`, o si production readiness no devuelve `advance`. Adjuntar ambos artefactos al change ticket y al evidence bundle.
