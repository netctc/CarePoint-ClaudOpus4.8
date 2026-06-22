# CarePoint V21.1 - Database Reset Pilot Seed Command Fix

## Issue fixed

The original V21 root command used:

```powershell
npx prisma db push --schema services/api/prisma/schema.prisma --force-reset --accept-data-loss
```

On Windows, this can fail with:

```text
'prisma' is not recognized as an internal or external command,
operable program or batch file.
```

This happens because the Prisma CLI dependency is installed inside the `@care-center/api` workspace, not as a root-level executable. The command was trying to resolve `prisma` from the repository root.

## Fix applied

The root script now delegates Prisma execution to the API workspace, where the Prisma CLI dependency exists.

### Root `package.json`

```json
"db:push": "npm run prisma:db:push --workspace @care-center/api",
"db:reset:pilot": "npm run prisma:db:push --workspace @care-center/api -- --force-reset --accept-data-loss && npm run prisma:generate && npm run prisma:reset:pilot --workspace @care-center/api"
```

### `services/api/package.json`

```json
"prisma:db:push": "prisma db push --schema prisma/schema.prisma"
```

## Command to run

From the repository root:

```powershell
npm install
npm run db:reset:pilot
```

If dependencies are already installed, only run:

```powershell
npm run db:reset:pilot
```

## What the command does

1. Runs Prisma `db push` from the API workspace.
2. Forces database reset with `--force-reset --accept-data-loss`.
3. Regenerates Prisma Client.
4. Executes `services/api/prisma/reset-pilot-seed.ts`.
5. Creates the controlled pilot dataset:
   - 5 HSP physicians with different specialties.
   - Online and in-person availability templates.
   - 20 patients with no appointments.
   - Auxiliary scheduling, catalog, coverage, facility, and audit data.

## Warning

This command deletes existing data in the database configured by `DATABASE_URL`.
