# PILOT-V5 - Feedback, Defect Burn-down, and Adoption Evidence

## Purpose

PILOT-V5 converts controlled pilot operation evidence from PILOT-V4 into a decision-ready package. It does not change runtime application code, backend contracts, database schema, or the Python worker.

## Inputs

- PILOT-V1 execution charter and cohort scope.
- PILOT-V2 staging deployment and environment activation evidence.
- PILOT-V3 day-0/day-1 launch runbook evidence.
- PILOT-V4 daily health review and incident triage evidence.
- QA-V7 final QA/UAT closure package.

## Feedback channels

The pilot decision package should include feedback from Admin, Provider, Operator/Reviewer, support intake, daily health review action items, and adoption observation logs.

## Defect burn-down policy

- P0: blocks expansion and may trigger rollback.
- P1: blocks expansion unless explicitly waived with owner and remediation date.
- P2: allowed with workaround or backlog owner.
- P3: does not block expansion but must be captured.
- Training issues: must become FAQ, job aid, or runbook updates if repeated.
- Enhancements: must be separated from defects.

## Adoption evidence

Adoption evidence should cover access success, workflow completion, support load, feedback sentiment, data/audit confidence, and rollback readiness.

## Output

The primary output is `validation/pilot/pilot-v5-feedback-defect-adoption-expansion-plan.json`.
