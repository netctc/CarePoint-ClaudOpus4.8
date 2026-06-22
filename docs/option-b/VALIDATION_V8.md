# CarePoint Option B - Validation V8

## Validaciones locales esperadas

```bash
npm run check:secrets --silent
npm run verify:workspace --silent
npm run verify:python-worker --silent
cd services/python-worker && python3 -m pytest -q
```

## Casos cubiertos

- Manifest expone version 0.8.0 y capacidades V8.
- Contrato ejecutable incluye `billing.payment_reconcile` y `clinical.records_access_audit`.
- Billing reconciliation genera reporte/advisory y artifact sin datos de tarjeta.
- Clinical records access audit genera indicadores con hashes y bloquea chart content por policy.
- Rutas Node bridge existen para ambos workloads.

## Criterio de avance

No aumentar canary de billing sobre 1% hasta tener comparaciones shadow con mismatch rate aceptable. Clinical audit permanece shadow-only/dry-run hasta revision formal de privacidad y cumplimiento.
