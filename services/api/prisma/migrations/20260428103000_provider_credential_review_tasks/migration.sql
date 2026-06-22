-- Provider credentialing review queue and reviewer assignment governance.
CREATE TYPE "ProviderCredentialReviewTaskStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'BLOCKED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ProviderCredentialReviewPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

CREATE TABLE "ProviderCredentialReviewTask" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "documentId" TEXT,
    "title" TEXT NOT NULL,
    "status" "ProviderCredentialReviewTaskStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "ProviderCredentialReviewPriority" NOT NULL DEFAULT 'NORMAL',
    "dueAt" TIMESTAMP(3),
    "assignedToId" TEXT,
    "createdById" TEXT,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "blockReason" TEXT,
    "decisionNote" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderCredentialReviewTask_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProviderCredentialReviewTask_organizationId_status_priority_dueAt_idx" ON "ProviderCredentialReviewTask"("organizationId", "status", "priority", "dueAt");
CREATE INDEX "ProviderCredentialReviewTask_providerId_status_idx" ON "ProviderCredentialReviewTask"("providerId", "status");
CREATE INDEX "ProviderCredentialReviewTask_assignedToId_status_idx" ON "ProviderCredentialReviewTask"("assignedToId", "status");

ALTER TABLE "ProviderCredentialReviewTask" ADD CONSTRAINT "ProviderCredentialReviewTask_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProviderCredentialReviewTask" ADD CONSTRAINT "ProviderCredentialReviewTask_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ProviderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProviderCredentialReviewTask" ADD CONSTRAINT "ProviderCredentialReviewTask_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ProviderCredentialDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProviderCredentialReviewTask" ADD CONSTRAINT "ProviderCredentialReviewTask_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProviderCredentialReviewTask" ADD CONSTRAINT "ProviderCredentialReviewTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
