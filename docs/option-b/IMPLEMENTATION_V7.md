# CarePoint Option B - Implementation V7

## Purpose

V7 expands the hybrid Python path from platform control-plane work into additional domain slices that are safe for progressive rollout. Node/Express remains the product API owner for authentication, RBAC/ABAC, object scope, Prisma queries, mutations and final delivery. Python receives only signed bridge requests, minimized Node-prefiltered data, hashed subjects or dry-run planning payloads.

## Added capabilities

- Admin accounts read-model preparation:
  - Job type: `admin.accounts_read_model`
  - Node route: `POST /api/hybrid-python/admin/accounts/read-model/prepare`
  - Python result: `admin.accounts_read_model.prepared`
  - Masks raw emails and emits only `emailMasked` plus `emailHash`.
  - Writes a sanitized artifact: `admin.accounts_read_model.page`.

- Provider role reconciliation advisory:
  - Job type: `admin.provider_role_reconcile`
  - Node route: `POST /api/hybrid-python/admin/provider-roles/reconcile/prepare`
  - Python result: `admin.provider_role_reconcile.completed`
  - Detects likely drift around `ProviderRoleCatalog` and `ProviderProfile.roleCatalogId` from schema/migration/code metadata.
  - Advisory only; it never changes Prisma schema, migrations or rows.

- Scheduling availability snapshot:
  - Job type: `scheduling.availability_snapshot`
  - Node route: `POST /api/hybrid-python/scheduling/availability/snapshot/prepare`
  - Python result: `scheduling.availability_snapshot.computed`
  - Computes aggregate window counts, status counts, group counts and minutes from Node-prefiltered hashed windows.
  - Booking rules and appointment mutations remain Node-owned.

- Messaging reminder plan:
  - Job type: `messaging.reminder_plan`
  - Node route: `POST /api/hybrid-python/messaging/reminders/plan/prepare`
  - Python result: `messaging.reminder_plan.planned`
  - Dry-run only. Uses recipient hashes and does not send messages.
  - Raw recipients, when supplied for local validation, are hashed before result/artifact output.

## Contract updates

The executable contract manifest now uses:

```text
schemaVersion=2026-05-option-b-v7
serviceVersion=0.7.0
```

New shared TypeScript schemas:

- `hybridPythonAccountsReadModelPrepareSchema`
- `hybridPythonProviderRoleReconcilePrepareSchema`
- `hybridPythonSchedulingAvailabilitySnapshotPrepareSchema`
- `hybridPythonMessagingReminderPlanPrepareSchema`

The contract test vector count is now 9.

## Rollout guidance

Recommended route-specific rollout order:

1. Keep all new routes in shadow mode.
2. Run contract validation and shadow comparisons for Admin read model and Scheduling snapshot.
3. Advance only `admin.accounts_read_model` and `scheduling.availability_snapshot` routes to 1% canary.
4. Keep `admin.provider_role_reconcile` and `messaging.reminder_plan` dry-run/shadow-only until operational review signs off.
5. Attach `/api/hybrid-python/evidence/bundle` output to each change ticket before increasing canary.

## Rollback

Rollback remains unchanged:

- Set `HYBRID_PYTHON_ENABLED=false`, or
- set route-specific canary to 0 via the rollout controller, or
- use `POST /api/hybrid-python/canary/rollout/rollback` for the affected route.

No database migration is required to roll back V7 because Python does not own tables or mutations.
