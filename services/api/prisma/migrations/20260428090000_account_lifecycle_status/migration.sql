-- Account lifecycle status for governed admin-managed patient and provider accounts.
-- ACTIVE accounts can authenticate. SUSPENDED and ARCHIVED accounts keep their data but cannot sign in.
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');

ALTER TABLE "User"
  ADD COLUMN "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "deactivatedAt" TIMESTAMP(3),
  ADD COLUMN "deactivationReason" TEXT;

CREATE INDEX "User_status_idx" ON "User"("status");
CREATE INDEX "User_organizationId_status_idx" ON "User"("organizationId", "status");
