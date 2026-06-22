# Phase 28 — Provider Role Catalog Schema Repair / Prisma P2022 Fix

## Problem fixed

After Phase 25 introduced maintainable provider roles, the Prisma schema and generated Prisma Client expect this new database structure:

- `ProviderRoleCatalog` table
- `ProviderProfile.roleCatalogId` column
- foreign key from `ProviderProfile.roleCatalogId` to `ProviderRoleCatalog.id`

The reported runtime logs show `P2022` errors like:

```text
The column `ProviderProfile.roleCatalogId` does not exist in the current database.
```

This means the application code and Prisma Client were updated, but the database migration was not applied to the active development database.

## Why it breaks multiple endpoints

Prisma selects scalar fields from `ProviderProfile` during normal `findMany()` calls. If the Prisma Client expects `roleCatalogId` but the database table does not have that column, any query touching `ProviderProfile` fails. This can cascade into:

- `/api/providers`
- `/api/providers/queue`
- payment summary routes that join or include provider profile data
- Admin dashboard sections that load provider/payment information

## What this phase adds

This phase adds a safe, idempotent repair path:

- Idempotent Prisma migration:
  - `services/api/prisma/migrations/20260429123000_provider_role_catalog_schema_repair/migration.sql`
- Manual repair SQL file:
  - `services/api/prisma/phase28-provider-role-catalog-repair.sql`
- Schema verification script:
  - `services/api/scripts/phase28/verify-provider-role-catalog-schema.mjs`
- Windows repair runner:
  - `scripts/phase28/phase28-repair-provider-role-catalog.ps1`
- Bash repair runner:
  - `scripts/phase28/phase28-repair-provider-role-catalog.sh`

## Recommended repair command

From the repository root on Windows PowerShell:

```powershell
.\scripts\phase28\phase28-repair-provider-role-catalog.ps1
```

Or manually:

```powershell
cd services/api
npm exec -- prisma db execute --schema prisma/schema.prisma --file prisma/phase28-provider-role-catalog-repair.sql
npm exec -- prisma generate --schema prisma/schema.prisma
node scripts/phase28/verify-provider-role-catalog-schema.mjs
```

Then restart:

```powershell
npm run dev --workspace @care-center/api
npm run dev:admin
npm run dev:provider
```

## Alternative: normal Prisma migration flow

If your database is clean and the Phase 25 migration has not been applied, you can also run:

```powershell
npm exec --workspace @care-center/api -- prisma migrate dev --schema prisma/schema.prisma
npm run prisma:generate --workspace @care-center/api
```

If Prisma reports migration history drift, use the manual repair SQL above first, then decide whether to mark the migration as resolved according to your database state.

## Expected verification output

The verification script should return:

```json
{
  "status": "READY",
  "checks": {
    "providerRoleCatalogTable": true,
    "roleCatalogIdColumn": true,
    "providerRoleCatalogRows": 4
  },
  "issues": []
}
```

## No environment changes

No `.env` file is included. No new environment variables are required.
