# Changelog V39 to V40

## Added

- `platform.domain_pilot_execution_review` for Phase 2 domain pilot run evidence, acceptance criteria, operator approvals and rollback readiness.
- `platform.phase_two_expansion_control_review` for bounded expansion waves, traffic limits, rollback triggers, checkpoints and approvals.
- Python and TypeScript contracts for both new gates.
- Node prepare routes and helper functions for both gates.
- Contract vectors and smoke tests for both gates.

## Unchanged safety model

- Python remains dry-run/advisory.
- Node keeps production authorization, tenancy, mutations, traffic decisions, rollout controls and rollback execution.
- Payloads are sanitized operational metadata only.
