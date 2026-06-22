# Phase 2 Pilot Expansion - V40

V40 is the first post-kickoff Phase 2 expansion package. It assumes V39 has established domain adoption readiness and rollout governance, then adds controls for real pilot execution evidence and bounded expansion waves.

## Gate 1: domain pilot execution

Reviews pilot domain enablement evidence, pilot run success/error rates, acceptance criteria, operator approvals and rollback plan status. Decision outputs are `pass`, `hold` or `rollback`.

## Gate 2: Phase 2 expansion control

Reviews expansion waves, traffic limits, rollback triggers, checkpoints, approvals and evidence status. It blocks when a target exceeds allowed traffic, checkpoint counts are insufficient, rollback triggers are missing, or approvals are incomplete.

## Operator-owned actions

The gates intentionally do not perform any production action. Operators/Node remain responsible for enabling flags, assigning cohorts, changing traffic, notifying users and executing rollback.
