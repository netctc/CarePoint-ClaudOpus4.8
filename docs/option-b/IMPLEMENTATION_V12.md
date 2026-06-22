# CarePoint Option B - Implementation V12

## Scope

V12 adds operational release hardening after the V11 release decision and rollback drill layer.

## Added jobs

- `platform.post_deploy_verify`: evaluates post-deploy health, smoke, SLO, rollout, job summary, comparison summary and privacy evidence. It returns `pass`, `hold` or `rollback` as an advisory decision and writes a sanitized artifact.
- `platform.change_ticket_bundle`: composes sanitized release evidence into a change-ticket-ready bundle. It reports missing evidence and keeps ticket creation, approvals, deployment and rollback outside Python.

## Node bridge routes

- `POST /api/hybrid-python/platform/post-deploy/verify/prepare`
- `POST /api/hybrid-python/platform/change-ticket/bundle/prepare`

Both routes force `dryRun: true` and are intended for release evidence, not production data mutation.

## Ownership boundary

Node/Express remains owner of API, auth, RBAC/ABAC, object scope, Prisma, production traffic, deployment and rollback. Python only evaluates metadata summaries and creates redacted artifacts.
