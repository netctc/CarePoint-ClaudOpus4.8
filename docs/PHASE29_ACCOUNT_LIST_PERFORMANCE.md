# Phase 29 – Account List Performance

## Objective

Improve the Admin Accounts CRUD list so it remains fast and stable when the number of users/patients/providers grows.

## Main changes to merge

### Backend

Add a reusable account-list query helper that converts request query parameters into safe Prisma query options:

- `page`
- `pageSize`
- `q`
- `role`
- `status`
- `organizationId`
- `sortBy`
- `sortDir`

The helper caps page size to avoid full-table payloads and normalizes sort/search values so the frontend cannot send unsafe query shapes.

### API endpoint target

Recommended endpoint contract:

`GET /api/admin/accounts?page=1&pageSize=25&q=&role=&status=&sortBy=createdAt&sortDir=desc`

Recommended response:

```json
{
  "items": [],
  "page": 1,
  "pageSize": 25,
  "total": 0,
  "totalPages": 0,
  "hasNextPage": false,
  "hasPreviousPage": false,
  "sortBy": "createdAt",
  "sortDir": "desc"
}
```

### Frontend

Replace full-list loading with URL-driven state:

- page and pageSize are explicit
- search is debounced
- filters reset to page 1
- refresh preserves current filters
- table rendering uses a stable row key
- large lists use virtualization or at least sliced rendering

## Performance acceptance criteria

- Initial account list loads only the selected page, not the full account table.
- API response includes `total`, `page`, `pageSize`, and `totalPages`.
- Search/filter/sort are performed on the backend.
- Default page size is 25.
- Maximum page size is capped at 100.
- Empty and error states remain clear.
- Existing create/update/delete flows refresh the current query instead of reloading all accounts.

## Security and RBAC acceptance criteria

- Endpoint must require authenticated admin/support role.
- Organization scoping must be preserved for non-super-admin users.
- Query filters must not allow cross-organization data leakage.
- Returned list item should avoid unnecessary sensitive fields.

## Prisma indexing recommendations

Review your current Prisma schema before applying. Typical helpful indexes are:

```prisma
@@index([organizationId, role])
@@index([organizationId, status])
@@index([organizationId, createdAt])
@@index([email])
```

Do not add duplicate indexes if they already exist.

## Validation commands

From project root:

```powershell
npm run prisma:generate --workspace @care-center/api
npm run build --workspace @care-center/api
npm run build --workspace @care-center/admin
```

If your package scripts differ, run the equivalent TypeScript/build checks.
