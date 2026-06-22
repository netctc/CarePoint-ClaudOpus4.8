# Phase 20 Merge Stabilization Checklist

## 1. Patch application order

Apply the implementation packages in this practical order:

1. Admin account governance cumulative patch through Phase 17.
2. Provider login alignment patch from Phase 18.
3. Provider logout patch from Phase 19.
4. Phase 20 stabilization patch.

If you have already merged earlier patches into your working branch, apply only the missing phases.

## 2. Static validation

Run from the project root:

```bash
node scripts/phase20/validate-phase20-merge.mjs
```

Expected output:

```text
Phase 20 merge readiness status: READY
```

`READY_WITH_WARNINGS` is acceptable only when warnings are known and documented, such as local `.env` files or Prisma version drift that will be resolved before production migration.

## 3. Prisma validation

Run:

```bash
npm run prisma:generate --workspace @care-center/api
npm exec --workspace @care-center/api -- prisma validate --schema services/api/prisma/schema.prisma
npm exec --workspace @care-center/api -- prisma migrate status --schema services/api/prisma/schema.prisma
```

Before production deployment:

```bash
npm exec --workspace @care-center/api -- prisma migrate deploy --schema services/api/prisma/schema.prisma
```

## 4. Backend validation

Run:

```bash
npm run build:api
npm run dev:api
```

Verify these route groups:

- `/api/admin/users/patients`
- `/api/admin/users/providers`
- `/api/admin/users/organizations`
- `/api/admin/users/audit`
- `/api/admin/users/audit/export`
- `/api/admin/users/data-quality`
- `/api/admin/users/governance-summary`
- `/api/admin/users/credential-governance/sweep`
- `/api/auth/logout`

## 5. Admin Web validation

Run:

```bash
npm run build:admin
npm run dev:admin
```

Verify:

- `/portal/accounts`
- `/portal/organizations`
- `/portal/audit/logs`
- account create/edit/delete flows
- organization create/edit/delete flows
- audit drill-down links from patient/provider rows
- filtered audit export
- governance and data-quality exports

## 6. Provider Web validation

Run:

```bash
npm run build:provider
npm run dev:provider
```

Verify:

- `/` redirects directly to `/sign-in`
- old landing page buttons do not appear
- login page style is aligned with Admin login
- OTP challenge still works
- development OTP code appears when returned by the API
- portal header shows Logout
- Logout clears session and returns to `/sign-in`

## 7. Database safety checks

Before migration on a shared database:

- Backup the database.
- Confirm migration order.
- Run migrations first on staging.
- Run credential governance sweep in preview mode before executing real actions.
- Confirm deleted account protection blocks records with clinical, payment, audit, RPM, support, or credential dependencies.

## 8. Release readiness gates

Do not release to production until:

- Prisma versions are aligned or Prisma commands are locked to the API workspace.
- API, Admin, and Provider builds pass.
- Login/logout smoke tests pass.
- Account CRUD and organization CRUD smoke tests pass.
- Audit export and governance reports are reviewed.
- No `.env` file is committed or packaged.
