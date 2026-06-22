# Phase 28 Merge Checklist — Provider Role Catalog Schema Repair

## Apply files

Copy these files into the repository:

- `services/api/prisma/migrations/20260429123000_provider_role_catalog_schema_repair/migration.sql`
- `services/api/prisma/phase28-provider-role-catalog-repair.sql`
- `services/api/scripts/phase28/verify-provider-role-catalog-schema.mjs`
- `scripts/phase28/phase28-repair-provider-role-catalog.ps1`
- `scripts/phase28/phase28-repair-provider-role-catalog.sh`

## Repair current development database

Run from repository root:

```powershell
.\scripts\phase28\phase28-repair-provider-role-catalog.ps1
```

## Restart services

```powershell
npm run dev --workspace @care-center/api
npm run dev:admin
npm run dev:provider
```

## Validate API

Check that these no longer return `P2022` / `500`:

- `GET /api/providers`
- `GET /api/providers/queue`
- `GET /api/payments/admin/summary`
- `GET /api/payments/reconciliation`
- `GET /api/admin/users/provider-roles`

## Validate UI

- Admin dashboard loads without provider/payment 500 failures.
- Admin `/portal/accounts` loads provider role catalog.
- Provider role dropdown renders in Provider create/edit form.
- Provider web dashboard loads queue/provider data.

## Important note

This phase fixes a database schema mismatch. If the error returns after deployment, the deployment database did not receive the migration or repair SQL.
