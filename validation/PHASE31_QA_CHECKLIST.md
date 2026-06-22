# Phase 31 QA Checklist

## Backend

- [ ] `npm run prisma:generate --workspace @care-center/api` passes.
- [ ] Migration reviewed against current schema before applying.
- [ ] Admin-only middleware protects every new endpoint.
- [ ] Organization ID is derived from authenticated user context.
- [ ] CSV preview rejects invalid emails.
- [ ] CSV preview reports duplicate file rows.
- [ ] CSV commit refuses invalid preview.
- [ ] CSV commit creates job record when `AccountBulkJob` is available.
- [ ] CSV commit creates account-level audit logs.
- [ ] Bulk lifecycle action creates job-level audit log.
- [ ] Bulk lifecycle action skips out-of-scope IDs.

## Frontend

- [ ] Bulk action bar appears only when one or more accounts are selected.
- [ ] Bulk action submit is disabled until an audit reason is entered.
- [ ] CSV drawer can preview pasted CSV.
- [ ] CSV commit is disabled when preview contains invalid rows.
- [ ] Export link downloads CSV.
- [ ] Successful mutation refreshes the account list.

## Regression

- [ ] Phase 29 account list pagination/search remains working.
- [ ] Phase 30 create/update/deactivate/reactivate audit behavior remains working.
- [ ] No `.env` file is introduced.
