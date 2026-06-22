# API Build Fixes Applied — 2026-05-02

This patch set fixes the TypeScript failures surfaced by `npm run build:api` after fail-fast builds were enabled.

## Verified

```bash
npm run build:api
```

completed successfully in this patched workspace.

## Main changes

- Pinned API workspace to `@types/express@^4.17.21` for Express 4 compatibility.
- Removed compile-time dependency on generated Prisma enum exports by centralizing Prisma access through `src/lib/prisma.ts`.
- Kept `noEmitOnError: true`; TypeScript errors are no longer ignored.
- Added explicit return types for audit-fallback stores so list/get/upsert/transition methods return concrete item types.
- Fixed Redis client typing in the OTP store.
- Fixed patient OTP request/verify payload typing.
- Fixed raw SQL calls against an `any`-typed Prisma client.
- Fixed dashboard/reporting casts where dynamic Prisma results are intentionally runtime-shaped.
- Fixed patient questionnaire completion check (`.isNotEmpty` was invalid JavaScript/TypeScript).
- Fixed provider analytics/calendar HSP scoping casts.
- Fixed missing `listRefillOperationalEvents` import.
