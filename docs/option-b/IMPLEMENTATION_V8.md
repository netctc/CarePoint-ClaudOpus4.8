# CarePoint Option B - Implementation V8

## Objetivo

V8 agrega dos slices funcionales progresivos alineados con la estrategia hibrida Python: billing reconciliation y clinical records access audit. Ambos mantienen a Node/Express como gateway de autenticacion, RBAC/ABAC, alcance organizacional, Prisma y mutaciones productivas.

## Nuevos workloads

### `billing.payment_reconcile`

Ruta Node: `POST /api/hybrid-python/billing/payments/reconcile/prepare`

Python recibe solo metadata de pagos prefiltrada por Node: hashes de pago/external id, estado interno, estado gateway, monto minor y moneda. El worker genera totales por moneda, conteos por estado y una lista acotada de discrepancias. No recibe PAN, CVV, tokens de metodo de pago, emails de cliente ni secretos de gateway.

### `clinical.records_access_audit`

Ruta Node: `POST /api/hybrid-python/clinical/records/access-audit/prepare`

Python recibe solo eventos de acceso con `actorHash`, `patientHash`, `resourceHash`, accion, outcome, timestamp y break-glass/reason code. Genera indicadores para revision: accesos fuera de horario, break-glass sin razon, actores con fan-out alto y denegaciones repetidas. No recibe contenido clinico, notas, diagnosticos, prescripciones ni resultados de laboratorio.

## Contratos y seguridad

- `schemaVersion=2026-05-option-b-v8`.
- Servicio Python `0.8.0`.
- Nuevos contratos ejecutables:
  - `cp.hybrid.billing.payment_reconcile.v1`
  - `cp.hybrid.clinical.records_access_audit.v1`
- Bridge firmado HMAC y politicas de minimizacion siguen siendo obligatorias para produccion.
- Clinical access audit queda `dry-run-only` y con canary maximo 0 hasta auditoria funcional/seguridad.

## Rollback

- Billing: setear canary de la ruta a 0 o `HYBRID_PYTHON_ENABLED=false`.
- Clinical audit: ignorar evidencia Python y mantener revision/auditoria en Node/reporting.
