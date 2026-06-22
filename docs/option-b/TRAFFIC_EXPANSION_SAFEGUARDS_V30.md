# Traffic Expansion Safeguards V30

V30 should be run after V29 promotion governance and before increasing traffic beyond the current canary step.

## Required evidence

1. SLO/error-budget metrics: availability, error rate, p95 latency, burn rate, error-budget remaining and sample size.
2. Alert coverage evidence for the promoted route/job types.
3. Automatic rollback trigger metadata showing enabled and not fired.
4. Manual rollback override evidence.
5. Node fallback evidence.
6. Feature-flag kill-switch metadata.
7. Rollback runbook and recent drill evidence.

## Decisions

- `pass`: evidence supports traffic expansion, but Node/control-plane must execute the change.
- `hold`: evidence is incomplete or too weak; keep current traffic.
- `rollback`: thresholds or safeguards are breached; do not promote and consider rollback through Node/control-plane.
