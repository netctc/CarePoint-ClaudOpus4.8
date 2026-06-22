# Phase 13 Merge Checklist — Credential Governance Automation

## Before applying this patch

- Confirm Phase 7+ credentialing tables exist in Prisma schema and migrations.
- Run `npm run prisma:generate --workspace @care-center/api` after merging schema changes from prior phases.
- Confirm Admin token cookies are working for `/portal/accounts`.
- Confirm provider accounts have organization scope.

## Merge order

1. Merge Prisma schema and migrations from previous phases first.
2. Merge `services/api/src/lib/provider-credential-governance-sweeper.ts`.
3. Merge `services/api/src/workers/run-provider-credential-governance-sweep.ts`.
4. Merge changes in `services/api/src/modules/admin-users/admin-users.routes.ts`.
5. Merge the new API script in `services/api/package.json`.
6. Merge Admin page and CSS updates.
7. Run Prisma generate.
8. Start API and Admin app.

## Manual verification

- Open `/portal/accounts` as an admin.
- Run the credential sweep in preview mode.
- Run the credential sweep in execute mode with reminders disabled first.
- Verify expired documents are marked `EXPIRED`.
- Verify review tasks are created once and are not duplicated by a second run.
- Enable reminder queueing and verify queued notifications appear in the notification center.
- Run the Phase 10 dispatch adapter separately only after SMTP/provider configuration is ready.

## Rollback notes

This phase adds no database migration and no destructive schema change. Rollback can be done by reverting:

- `provider-credential-governance-sweeper.ts`
- `run-provider-credential-governance-sweep.ts`
- added route endpoint in `admin-users.routes.ts`
- added script in `services/api/package.json`
- Admin UI/CSS additions

Any data created by executed sweeps remains in normal operational tables: credential review tasks, credential notifications, audit logs, and `EXPIRED` document status updates.
