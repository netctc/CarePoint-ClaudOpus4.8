# CarePoint Option B Python Progressive - V50 Implementation

## Purpose

V50 is a targeted build-repair release on top of V49. It responds to the Windows `npm run build:api` failure reported after V49 and focuses on making the Node API TypeScript build pass with the current repository contents.

This release does not add new Python worker job types. The Python worker contract manifest remains at the V49 contract surface because the failing evidence was in the Node API compile layer, not in Python contract validation.

## Build errors addressed

Reported API build failures:

1. `coverageRouter` not found in `src/app.ts`.
2. Prisma enum exports missing from `@prisma/client` in `provider-credential-governance-sweeper.ts`.
3. Prisma enum exports missing from `@prisma/client` in `admin-users.routes.ts`.
4. `Prisma.PrismaClientKnownRequestError` not found on the generated Prisma namespace.
5. Derived `error.code` and `error.meta` access failures caused by the failed Prisma error type narrowing.

## Changes

### Coverage router wiring

- Kept the explicit `coverageRouter` import in `services/api/src/app.ts`.
- Kept route mounting at `apiRoutePaths.coverage`.
- Verified the TypeScript compiler resolves the symbol during `npm run build:api`.

### Prisma enum compile stability

- Replaced generated Prisma enum imports in `services/api/src/lib/provider-credential-governance-sweeper.ts` with local string-literal enum mirrors matching `schema.prisma`.
- Replaced generated Prisma enum imports in `services/api/src/modules/admin-users/admin-users.routes.ts` with local string-literal enum mirrors matching `schema.prisma`.
- This prevents TypeScript build failures when `@prisma/client` has not been regenerated yet or is stale in a local checkout.

### Prisma known request error narrowing

- Replaced `Prisma.PrismaClientKnownRequestError` usage with `PrismaClientKnownRequestError` from `@prisma/client/runtime/library`.
- Restored type narrowing for `error.code` and `error.meta` in provider create/update error translation.

## Operational guidance

For local development or CI, continue to run Prisma generation whenever the Prisma schema changes:

```bash
npm run prisma:generate --workspace @care-center/api
```

The V50 build fix makes TypeScript compilation more tolerant of stale generated enum exports, but Prisma generation is still required for runtime database client correctness after schema changes.
