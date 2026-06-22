-- Phase 31: Account bulk job tracking
-- Safe additive migration. Review table/column names against your current Prisma schema before applying.

CREATE TABLE IF NOT EXISTS "AccountBulkJob" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "facilityId" TEXT NULL,
  "requestedByUserId" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "inputSummary" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "resultSummary" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "errorSummary" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3) NULL,
  "finishedAt" TIMESTAMP(3) NULL
);

CREATE INDEX IF NOT EXISTS "AccountBulkJob_org_created_idx"
  ON "AccountBulkJob" ("organizationId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "AccountBulkJob_requested_by_idx"
  ON "AccountBulkJob" ("requestedByUserId", "createdAt" DESC);

-- Optional foreign keys. Enable only if your concrete table names match.
-- ALTER TABLE "AccountBulkJob" ADD CONSTRAINT "AccountBulkJob_organization_fkey"
--   FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- ALTER TABLE "AccountBulkJob" ADD CONSTRAINT "AccountBulkJob_requested_by_fkey"
--   FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
