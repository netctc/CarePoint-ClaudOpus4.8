-- Phase 28: provider role catalog schema repair / idempotent safety migration.
-- Purpose:
--   Repair local/dev databases where Phase 25 code was applied but the database
--   was not migrated, causing Prisma P2022 errors for ProviderProfile.roleCatalogId.
-- Notes:
--   This migration is intentionally idempotent so it is safe after a partial/manual apply.

CREATE TABLE IF NOT EXISTS "ProviderRoleCatalog" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "systemRole" "UserRole" NOT NULL DEFAULT 'PROVIDER',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 100,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProviderRoleCatalog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProviderRoleCatalog_code_key" ON "ProviderRoleCatalog"("code");
CREATE INDEX IF NOT EXISTS "ProviderRoleCatalog_systemRole_idx" ON "ProviderRoleCatalog"("systemRole");
CREATE INDEX IF NOT EXISTS "ProviderRoleCatalog_isActive_idx" ON "ProviderRoleCatalog"("isActive");
CREATE INDEX IF NOT EXISTS "ProviderProfile_roleCatalogId_idx" ON "ProviderProfile"("roleCatalogId");

ALTER TABLE "ProviderProfile"
  ADD COLUMN IF NOT EXISTS "roleCatalogId" TEXT;

DO $$
BEGIN
  ALTER TABLE "ProviderRoleCatalog"
    ADD CONSTRAINT "ProviderRoleCatalog_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ProviderProfile"
    ADD CONSTRAINT "ProviderProfile_roleCatalogId_fkey"
    FOREIGN KEY ("roleCatalogId") REFERENCES "ProviderRoleCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO "ProviderRoleCatalog" ("id", "code", "label", "systemRole", "isActive", "isSystem", "sortOrder", "createdAt", "updatedAt")
VALUES
  ('provider-role-provider', 'PROVIDER', 'Provider', 'PROVIDER', true, true, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('provider-role-nurse', 'NURSE', 'Nurse', 'NURSE', true, true, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('provider-role-pharmacist', 'PHARMACIST', 'Pharmacist', 'PHARMACIST', true, true, 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('provider-role-lab-tech', 'LAB_TECH', 'Lab technician', 'LAB_TECH', true, true, 40, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "label" = EXCLUDED."label",
  "systemRole" = EXCLUDED."systemRole",
  "isActive" = true,
  "isSystem" = true,
  "sortOrder" = EXCLUDED."sortOrder",
  "updatedAt" = CURRENT_TIMESTAMP;

UPDATE "ProviderProfile" AS profile
SET "roleCatalogId" = catalog."id"
FROM "ProviderRoleCatalog" AS catalog
JOIN "User" AS u ON u."role"::TEXT = catalog."code"
WHERE profile."userId" = u."id"
  AND profile."roleCatalogId" IS NULL;
