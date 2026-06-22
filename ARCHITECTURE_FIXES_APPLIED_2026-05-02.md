# Architecture Fixes Applied — 2026-05-02

## Scope

This patch applies the architecture audit fixes for the CarePoint HSP monorepo:

- `apps/admin`
- `apps/provider`
- `apps/mobile`
- `apps/provider_mobile`
- `services/api`
- `packages/contracts`

## Fixes Applied

### API build now fails fast

`services/api/package.json` now runs:

```json
"build": "tsc -p tsconfig.json"
```

The previous Dokploy hotfix build that ignored TypeScript errors was removed.

`services/api/tsconfig.json` now has:

```json
"noEmitOnError": true
```

### Coverage hotfix router removed

The inline unauthenticated coverage router was removed from:

```text
services/api/src/app.ts
```

The real secured module is now mounted:

```text
services/api/src/modules/coverage/coverage.routes.ts
```

### Release request routes mounted

The existing release request router is now mounted under the records API path:

```text
/api/records/release-requests
/api/records/release-requests/:requestId
```

### Socket.IO injection order fixed

`createApp` now accepts a Socket.IO getter and injects `req.io` before API routes are mounted.

This fixes route handlers such as messaging emits that depend on:

```ts
req.io?.to(...).emit(...)
```

### Production environment safety improved

Production no longer accepts local fallback values for critical environment variables.

Affected variables:

```text
DATABASE_URL
REDIS_URL
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
```

### Prisma ownership normalized

Root-level Prisma dependencies were removed.

Prisma is now owned by:

```text
services/api/package.json
```

The lockfile was refreshed with:

```bash
npm install --package-lock-only --ignore-scripts --offline
```

### Audit fallback stores guarded in production

The following stores now fail fast in production when expected Prisma models are missing:

```text
services/api/src/lib/admin-config-store.ts
services/api/src/lib/provider-workspace-store.ts
services/api/src/lib/patient-workspace-store.ts
```

Emergency override:

```text
ALLOW_AUDIT_FALLBACK_IN_PRODUCTION=true
```

Keep this false or empty for production.

### Coverage contracts moved into shared package

Coverage rule validation now lives in:

```text
packages/contracts/src/index.ts
```

The API coverage router imports:

```ts
coverageRuleSchema
coverageRuleUpdateSchema
```

from `@care-center/contracts`.

Shared route path constants were also added for the fixed contract-sensitive mounts.

## Validation Performed

Succeeded:

```bash
npm install --package-lock-only --ignore-scripts --offline
```

Static checks confirmed:

- inline coverage hotfix removed
- real coverage router imported and mounted
- release router mounted
- Socket.IO late middleware removed from `index.ts`
- Socket.IO injection exists before routes in `app.ts`
- API build fails on TypeScript errors
- root Prisma dependency removed
- production env guard added
- production audit fallback guards added
- coverage validation moved into contracts

Not completed in this environment:

```bash
npm ci --ignore-scripts --offline
```

This failed because the local npm cache did not contain `undici-types-6.21.0.tgz`. Run the full install and build in a networked development or CI environment.

## Recommended Post-Patch Commands

```bash
npm ci
npm run build:contracts
npm run build:api
npm run build:admin
npm run build:provider
```

API smoke checks:

```bash
curl -i http://localhost:4000/api/coverage/summary
curl -i http://localhost:4000/api/records/release-requests
```

Expected without auth:

```text
401 Unauthorized
```
