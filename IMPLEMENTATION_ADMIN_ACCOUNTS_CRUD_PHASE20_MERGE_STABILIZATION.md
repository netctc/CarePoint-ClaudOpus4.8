# Phase 20 — Merge Stabilization, Build Validation, and Migration Readiness

## Objective

Phase 20 does not add a new business feature. It stabilizes the accumulated work from phases 1–19 so it can be merged into the real CarePoint workspace with a lower risk of route, migration, and build drift.

The phase focuses on:

- Static merge-readiness validation.
- Migration order verification.
- Provider login/logout flow verification.
- Admin account, organization, audit, credential, notification, and reporting route verification.
- Prisma version alignment warnings.
- Manual smoke-test commands for API, Admin Web, and Provider Web.

## Files added

```text
scripts/phase20/validate-phase20-merge.mjs
scripts/phase20/phase20-validate.sh
scripts/phase20/phase20-validate.ps1
docs/merge-checklists/admin-accounts-phase20-merge-stabilization-checklist.md
docs/deployment/phase20-migration-order-and-release-readiness.md
docs/api-tests/phase20-account-governance-smoke.http
docs/validation/phase20-static-preview-report.md
IMPLEMENTATION_ADMIN_ACCOUNTS_CRUD_PHASE20_MERGE_STABILIZATION.md
```

## How to use

After applying the previous implementation patches into the real project root, copy this Phase 20 patch into the same root and run one of the following:

### Windows PowerShell

```powershell
powershell -ExecutionPolicy Bypass -File scripts/phase20/phase20-validate.ps1
```

### Bash / Linux / macOS / VPS

```bash
bash scripts/phase20/phase20-validate.sh
```

### Direct Node command

```bash
node scripts/phase20/validate-phase20-merge.mjs
```

The validator writes:

```text
docs/validation/phase20-merge-readiness-report.md
docs/validation/phase20-merge-readiness-report.json
```

## What the validator checks

- Required Admin pages exist:
  - `/portal/accounts`
  - `/portal/organizations`
  - `/portal/audit/logs`
- Required Provider pages/components exist:
  - `/` redirects directly to `/sign-in`
  - `/sign-in` exists
  - Provider top header has logout support
  - Provider API client calls `/api/auth/logout`
- Admin user governance backend route contains expected surfaces:
  - patient/provider CRUD
  - organization management
  - audit export
  - credential documents
  - credential review tasks
  - notifications
  - data quality
  - governance sweep
- Prisma schema contains expected credential governance models and enums.
- Required migration folders are present and ordered.
- Prisma root/API package version mismatch is reported as a warning.
- `.env` files are reported as informational only; do not package or commit them.

## Required manual build checks after dependencies are available

```bash
npm install
npm run prisma:generate --workspace @care-center/api
npm exec --workspace @care-center/api -- prisma validate --schema services/api/prisma/schema.prisma
npm exec --workspace @care-center/api -- prisma migrate status --schema services/api/prisma/schema.prisma
npm run build:api
npm run build:admin
npm run build:provider
```

For a staging or production-like database, use:

```bash
npm exec --workspace @care-center/api -- prisma migrate deploy --schema services/api/prisma/schema.prisma
```

Use `migrate dev` only for local development.

## Important migration note

The original workspace has historically shown a Prisma mismatch between the root package and the API workspace. The root package references Prisma 7 while the API workspace references Prisma 5. Before production deployment, standardize both `prisma` and `@prisma/client` to the same major version.

Because the API package and existing schema style are Prisma 5-compatible, the safer immediate stabilization path is:

- Keep API on Prisma 5 for the first production merge.
- Align root Prisma dependencies to the API major version, or run Prisma commands only from the API workspace.
- Upgrade to Prisma 7 later as a dedicated migration phase.

## No environment file included

This patch does not include `.env` or secret values. If any command requires environment variables, add them manually in your local or server environment.
