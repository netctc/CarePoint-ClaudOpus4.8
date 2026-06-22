# Phase 17 merge checklist

- [ ] Apply patch after Phase 16.
- [ ] Confirm `/portal/organizations` appears in the Admin sidebar.
- [ ] Confirm organization create/modify/delete actions work.
- [ ] Confirm delete is blocked for organizations with dependencies.
- [ ] Confirm patient creation works with an empty organization selector.
- [ ] Confirm provider creation works with an empty organization selector.
- [ ] Confirm CSV import works when `organizationId` and `organizationName` are empty.
- [ ] Confirm fallback organization `Unassigned CarePoint Organization` is created/used automatically.
- [ ] Confirm organization audit links load through `/portal/audit/logs?resource=organization`.
- [ ] Run `npm run prisma:generate --workspace @care-center/api` after merging if Prisma Client was regenerated in your environment.
- [ ] Run the Admin and API builds in your full local workspace with dependencies installed.
