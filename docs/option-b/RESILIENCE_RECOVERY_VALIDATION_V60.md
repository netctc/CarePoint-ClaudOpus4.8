# Resilience Governance and Recovery Validation V60

V60 extends steady-state operations with periodic evidence reviews for resilience governance and recovery capability.

## Operational resilience governance

The review checks sanitized resilience controls, chaos drills, failover readiness, service ownership, risk items, governance reviews, approvals and evidence. The result is advisory only. Operators remain responsible for executing failovers, accepting risks, publishing governance decisions and changing owners or tickets.

## Recovery capability validation

The review checks sanitized restore-test outcomes, RTO/RPO checks, backup integrity metadata, incident replay results, dependency recovery readiness, communication validation, risks, approvals and evidence. Python does not restore backups, execute failovers, send communications or mutate records.

## Decision model

Both jobs return `pass`, `hold` or `rollback` using metadata-only evidence and generate redacted JSON artifacts for governance traceability.
