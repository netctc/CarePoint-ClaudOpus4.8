# Option B - Hybrid Python Progressive - Implementation V13

## Focus

V13 adds operational handoff and incident simulation slices. Node/Express remains the owner of API, auth, RBAC/ABAC, Prisma, production routing, deployment and rollback. Python produces dry-run, metadata-only operational evidence.

## New job types

- `platform.operational_handoff`: composes a release handoff pack with owner contacts, dashboards, alert policies, runbooks, support windows, known risks and artifact references. It reports missing sections before a canary release is considered operationally ready.
- `platform.incident_simulation`: generates a dry-run incident response plan for scenarios such as Python service outage, latency regression, shadow mismatch, privacy block, queue backlog and artifact leak signal.

## Node bridge routes

- `POST /api/hybrid-python/platform/operational/handoff/prepare`
- `POST /api/hybrid-python/platform/incidents/simulate/prepare`

## Safety boundaries

- No pager tokens, credentials, raw logs, request bodies, headers, PHI or patient identifiers cross the bridge.
- Python does not create tickets, notify operators, mutate rollout state or execute rollback commands.
- Outputs are advisory artifacts to support release and incident workflows owned by Node/CI/operators.
