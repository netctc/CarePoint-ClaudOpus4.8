# Phase 30 – Account Mutation Audit Hardening

## Objective

After Phase 29 improved list performance, Phase 30 focuses on the mutation side of Admin Accounts CRUD. The goal is to make create, update, deactivate, reactivate, and delete/account-removal workflows safer, more auditable, and easier to validate in development.

## Main changes to merge

### Backend

Add reusable helpers for:

- mutation policy checks
- self-protection rules
- cross-organization protection
- role-escalation protection
- safe audit event writing
- normalized validation for create and update payloads

### API endpoint target

Recommended endpoint family:

```text
GET    /api/admin/accounts
POST   /api/admin/accounts
PATCH  /api/admin/accounts/:accountId
POST   /api/admin/accounts/:accountId/deactivate
POST   /api/admin/accounts/:accountId/reactivate
DELETE /api/admin/accounts/:accountId
```

Recommended mutation response:

```json
{
  "item": {
    "id": "usr_123",
    "email": "person@example.com",
    "name": "Example User",
    "role": "PROVIDER",
    "status": "ACTIVE",
    "organizationId": "org_123",
    "updatedAt": "2026-04-30T00:00:00.000Z"
  },
  "audit": {
    "attempted": true,
    "written": true
  }
}
```

### Frontend

Add mutation helpers that:

- send consistent JSON requests
- return normalized errors from the API
- support create/update/deactivate/reactivate/delete flows
- refresh the current Phase 29 paged query after success
- keep destructive actions explicit and visible to the admin

## Mutation policy acceptance criteria

- Super admin can manage accounts across organizations only if your current RBAC model allows it.
- Company admin is restricted to their own organization.
- Support role can be configured as read-only or limited mutation role, depending on your current policy.
- An admin cannot deactivate or delete their own active session account.
- A non-super-admin cannot grant `SUPER_ADMIN` or move an account to another organization.
- Delete should be soft-delete/deactivate by default unless your data retention policy explicitly permits hard delete.
- Every successful mutation should write an audit event, or at least log a non-blocking audit failure.

## Security notes

- Never trust `organizationId` from the client for non-super-admin mutations.
- Never return password hashes, OTP secrets, refresh tokens, reset tokens, or provider credentials in account responses.
- Validate role/status values against the enums already used in your Prisma schema.
- Keep patient/provider domain records separate from the user account record unless the route explicitly handles those domain details.

## Prisma/data-model notes

This phase does not require a migration by default. It assumes you already have a user/account model with fields similar to:

- `id`
- `email`
- `firstName`
- `lastName`
- `role`
- `status`
- `organizationId`
- `createdAt`
- `updatedAt`

If your audit table uses a different model name, update `account-mutation-audit.ts` to match the existing audit writer.

## Validation commands

From project root:

```powershell
npm run prisma:generate --workspace @care-center/api
npm run build --workspace @care-center/api
npm run build --workspace @care-center/admin
```

Then start the API and Admin app and manually test:

- create account
- update account name/role/status
- deactivate account
- reactivate account
- blocked self-deactivation
- blocked cross-organization update
- audit log visibility if your audit screen already exists
