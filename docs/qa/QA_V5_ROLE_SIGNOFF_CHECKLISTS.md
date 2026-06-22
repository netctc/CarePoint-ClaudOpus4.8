# QA-V5 - Role Signoff Checklists

## Admin signoff checklist

- Admin can authenticate and access protected Admin routes.
- Admin can review or execute account management scenarios.
- Admin can validate audit log filters and evidence surfaces.
- Admin can validate reports or KPI builder surfaces.
- Admin can complete navigation, focus, and responsive smoke checks.
- No unresolved P0 Admin defect remains open.

## Provider signoff checklist

- Provider can authenticate and access Provider portal routes.
- Provider dashboard loads workload and KPI context.
- Provider queue and clinical worklist flows are understandable.
- Provider calendar and appointment surfaces support review flows.
- Prescription and encounter note flows can be reviewed without blockers.
- Keyboard-only critical action access passes smoke review.
- No unresolved P0 Provider defect remains open.

## Operator/Reviewer signoff checklist

- Audit evidence is traceable and understandable.
- Report/KPI outputs can support operational review.
- Error/log evidence avoids exposing sensitive data.
- Defects are triaged with severity, owner, and next action.

## Platform/Technical Owner signoff checklist

- `npm install` and API build evidence are available.
- QA-V1 through QA-V4 audit evidence is available.
- Python worker verification evidence is available.
- Security smoke and readiness prerequisites are acknowledged.
- No unresolved P0 technical readiness defect remains open.

## Signoff fields

- role;
- stakeholder name;
- environment;
- build or package identifier;
- scenario IDs executed;
- accepted yes/no;
- blocking defects;
- accepted limitations or deferrals;
- signature or approval reference;
- approval date.
