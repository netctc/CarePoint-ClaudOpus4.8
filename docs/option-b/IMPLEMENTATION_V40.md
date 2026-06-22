# Option B Python Progressive V40 - Phase 2 Pilot Expansion Controls

V40 continues Phase 2 after the V39 kickoff. It adds advisory/dry-run gates for controlled domain pilot execution and bounded expansion-wave controls. Node remains the production control plane for auth, RBAC/ABAC, tenant scoping, traffic allocation, feature flags, rollback execution and customer communication. Python only evaluates sanitized operational metadata and writes evidence artifacts.

## Added jobs

- `platform.domain_pilot_execution_review`
- `platform.phase_two_expansion_control_review`

## Node bridge routes

- `/api/hybrid-python/platform/domain-pilot/execution/review/prepare`
- `/api/hybrid-python/platform/phase-two/expansion/control/review/prepare`

## Acceptance

- Pilot domains, pilot runs, acceptance criteria, operator approvals and rollback evidence are present.
- Expansion waves are bounded by target traffic limits and checkpoint/approval requirements.
- Rollback triggers are configured before expanding traffic.
- Python remains advisory and does not mutate domains, feature flags, cohorts, traffic or rollback state.
