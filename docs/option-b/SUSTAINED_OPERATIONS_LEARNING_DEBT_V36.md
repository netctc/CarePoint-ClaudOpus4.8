# Sustained Operations Learning and Debt Governance V36

V36 adds two advisory gates for sustained production operation after continuity and audit readiness are already in place.

## Post-incident learning gate

Use this gate after production canary, incident drills or actual incidents to ensure learnings are captured before expanding sustained traffic.

Passing evidence should include:

- incident class coverage for severe, rollback and privacy-related scenarios
- linked or completed postmortem metadata
- owner acknowledgements
- action items that are not stale
- regression guards that passed

The output is an advisory artifact. It does not update tickets, incidents, postmortems or remediation trackers.

## Technical-debt governance gate

Use this gate before broadening sustained traffic when release risk depends on accepted debt, waivers or remediation plans.

Passing evidence should include:

- required debt categories such as security, reliability, contracts and observability
- owner acknowledgement for debt items
- bounded critical debt count
- approved waivers with expiry metadata
- a passing remediation plan

The output is an advisory artifact. It does not mutate backlog items, waivers or remediation plans.

## Operator guidance

A `pass` decision can be attached to the sustained-operations evidence bundle. A `hold` decision should pause expansion until warnings are resolved. A `rollback` decision should block further sustained traffic expansion until the blockers are corrected and the gate is rerun.
