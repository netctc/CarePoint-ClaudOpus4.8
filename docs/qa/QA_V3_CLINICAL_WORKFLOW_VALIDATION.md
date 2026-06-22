# QA-V3 Clinical Workflow Validation

## Clinical workflow groups

### Dashboard and workload

Validate that the Provider dashboard loads active workload, clinical KPI cards, fallback state, and refresh behavior.

### Queue and refill worklist

Validate filtering, task opening, governed refill context, role assignment, aging band filters, controlled-only filters, and audit/evidence summaries.

### Calendar and appointments

Validate day/week schedule visibility, appointment status context, slot metadata, facility filters, and appointment detail navigation.

### Prescriptions

Validate required-field behavior, clinical warning visibility, pharmacy context, refill/compliance evidence, save/submit feedback, and detail review.

### Encounter notes

Validate SOAP draft preservation, patient context, validation path, signature attestation, and signed-note confirmation.

### Supporting clinical surfaces

Validate patient chart, labs inbox/result, messages, orders, telehealth, settings, team, and i18n smoke behavior.

## Acceptance posture

All P0 Provider scenarios must pass before production readiness signoff. P1/P2 issues must be triaged, assigned severity, and either resolved or explicitly accepted before go-live.
