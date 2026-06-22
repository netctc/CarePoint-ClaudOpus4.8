# Option B Python Progressive V28 - Post-release hardening gates

V28 is cumulative over V27 and adds two advisory gates for operating the hybrid Python path after release closure.

## Added jobs

- `platform.production_canary_observation_review`
- `platform.incident_response_readiness_review`

Both jobs are dry-run-only. Python reviews sanitized evidence and emits reports/artifacts only. Node/control-plane and operators remain owners of traffic routing, paging, ticketing and rollback execution.

## Node bridge routes

- `/api/hybrid-python/platform/production-canary/observation/review/prepare`
- `/api/hybrid-python/platform/incident-response/readiness/review/prepare`

## Worker and manifest

- Python worker version: `0.28.0`
- Contract manifest schema: `2026-05-option-b-v28`

## Data handling

Production canary observation accepts aggregate telemetry only: error rate, p95 latency, mismatch rate, failed job count, queue lag, HMAC rejects and artifact failures. Incident response readiness accepts on-call, escalation, runbook, communication and drill metadata only. No PHI, tokens, cookies, raw request payloads or secret values should be included.
