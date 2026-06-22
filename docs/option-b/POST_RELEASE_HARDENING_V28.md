# V28 Post-release hardening summary

V28 extends the V27 closure package with two post-release controls.

## Production canary observation

Use this gate before increasing canary after release closure. Required evidence should include aggregate error rate, latency, mismatch rate, failed jobs, queue lag, HMAC rejects, artifact failures, sample size and rollback triggers.

## Incident response readiness

Use this gate before continued promotion or handoff to steady-state operations. Required evidence should include primary and secondary on-call coverage, rollback owner, incident commander, customer communication path, runbook and pager route.

## Decision semantics

- `pass`: evidence is clean and can be attached to release artifacts.
- `hold`: missing/inconclusive evidence should be remediated before promotion.
- `rollback`: breached signals or missing required operational coverage should block promotion and trigger operator-owned rollback/mitigation review.
