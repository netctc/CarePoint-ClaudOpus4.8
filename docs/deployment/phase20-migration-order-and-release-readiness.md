# Phase 20 Migration Order and Release Readiness

## Credential governance migration order

Run credential governance migrations in chronological order:

```text
20260428100000_provider_credential_documents
20260428103000_provider_credential_review_tasks
20260428110000_provider_credential_notifications
20260428113000_provider_credential_notification_dispatch
```

These migrations introduce the provider credential document, review task, notification queue, and dispatch metadata structures used by the Admin account governance workflow.

## Recommended local development command sequence

```bash
npm install
npm run prisma:generate --workspace @care-center/api
npm exec --workspace @care-center/api -- prisma migrate dev --schema services/api/prisma/schema.prisma
npm run build:api
npm run build:admin
npm run build:provider
```

## Recommended staging/production command sequence

```bash
npm install --omit=dev
npm exec --workspace @care-center/api -- prisma generate --schema services/api/prisma/schema.prisma
npm exec --workspace @care-center/api -- prisma migrate deploy --schema services/api/prisma/schema.prisma
npm run build:api
npm run build:admin
npm run build:provider
```

Your existing deployment may require dev dependencies for TypeScript/Next build. If the build runs inside the deployment image, install dependencies according to the current Dockerfile strategy.

## Prisma version stabilization

The current project history indicates root-level Prisma 7 dependencies while the API workspace uses Prisma 5. This can produce different CLI behavior depending on which workspace executes Prisma commands.

For the next production-safe release, use one of these approaches:

### Safer immediate approach

- Keep the API workspace on Prisma 5.
- Execute Prisma commands using the API workspace.
- Align root `prisma` and `@prisma/client` to Prisma 5, or avoid using root Prisma commands.

### Later upgrade approach

- Create a separate Prisma 7 upgrade phase.
- Add `prisma.config.ts` if needed.
- Confirm schema datasource compatibility.
- Regenerate the client and run full API regression tests.

## Worker readiness

Phase 10 and Phase 13 introduced optional operational workers:

```bash
npm run credential-notifications:dispatch --workspace @care-center/api
npm run credential-governance:sweep --workspace @care-center/api
```

Use them manually first. After verification, they can be scheduled through your VPS/Dokploy cron, a process manager, or a job queue.

## Environment variables

No `.env` file is included in the patch. If real notification dispatch is enabled later, add provider variables manually according to the Phase 10 implementation note.

## Rollback notes

A code rollback is straightforward if migrations have not been deployed.

If migrations have been deployed, do not manually delete tables in production without a backup. The safer rollback pattern is:

1. Disable new UI entry points.
2. Stop credential notification/governance workers.
3. Keep new tables in place until a verified down-migration plan exists.
4. Restore database from backup only if the release causes critical data integrity issues.
