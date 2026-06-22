# Admin Accounts CRUD Phase 3 — Account Lifecycle Hardening

## Scope
This phase extends the Admin **Patient & Provider Accounts** implementation with lifecycle controls and safer authentication behavior.

## Added capabilities
- Account lifecycle status on `User`: `ACTIVE`, `SUSPENDED`, `ARCHIVED`.
- Admin UI status selector for patient and provider create/modify forms.
- Admin search and lifecycle filters for patient/provider account lists.
- Status badges in the account lists.
- Optional deactivation reason stored with suspended/archived accounts.
- Session revocation when an account is suspended or archived.
- Authentication blocking for non-active accounts:
  - password login
  - privileged OTP/challenge flow
  - patient OTP request/verify
  - refresh-token renewal
  - authenticated API middleware (`requireAuth`)
- Dedicated status endpoints:
  - `PATCH /api/admin/users/patients/:patientId/status`
  - `PATCH /api/admin/users/providers/:providerId/status`

## Database changes
A Prisma migration was added:

`services/api/prisma/migrations/20260428090000_account_lifecycle_status/migration.sql`

It adds:
- `AccountStatus` enum
- `User.status`
- `User.deactivatedAt`
- `User.deactivationReason`
- indexes on `User.status` and `(User.organizationId, User.status)`

## Operational notes
Run the normal Prisma workflow after applying the package:

```bash
npm run prisma:generate --workspace @care-center/api
npm run prisma:migrate --workspace @care-center/api
```

If your project uses a different migration command, apply the new migration through the same process you already use.

## Security behavior
Suspending or archiving an account is a soft-control action. It keeps the patient/provider clinical history intact, revokes existing refresh tokens, and blocks future authenticated access. Hard deletion remains protected by dependency checks and is blocked if clinical, booking, messaging, payment, audit, RPM, support, or care-plan records exist.

## Environment variables
No `.env` file is included and no new environment variables are required for this phase.
