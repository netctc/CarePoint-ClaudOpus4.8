-- Provider credential notification/reminder queue for governed credential follow-up.
CREATE TYPE "ProviderCredentialNotificationChannel" AS ENUM ('EMAIL', 'IN_APP', 'MANUAL');
CREATE TYPE "ProviderCredentialNotificationStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'CANCELLED');

CREATE TABLE "ProviderCredentialNotification" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "documentId" TEXT,
  "taskId" TEXT,
  "channel" "ProviderCredentialNotificationChannel" NOT NULL DEFAULT 'IN_APP',
  "status" "ProviderCredentialNotificationStatus" NOT NULL DEFAULT 'QUEUED',
  "subject" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "recipientEmail" TEXT,
  "scheduledFor" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "createdById" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProviderCredentialNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProviderCredentialNotification_organizationId_status_scheduledFor_idx" ON "ProviderCredentialNotification"("organizationId", "status", "scheduledFor");
CREATE INDEX "ProviderCredentialNotification_providerId_status_idx" ON "ProviderCredentialNotification"("providerId", "status");
CREATE INDEX "ProviderCredentialNotification_documentId_idx" ON "ProviderCredentialNotification"("documentId");
CREATE INDEX "ProviderCredentialNotification_taskId_idx" ON "ProviderCredentialNotification"("taskId");

ALTER TABLE "ProviderCredentialNotification" ADD CONSTRAINT "ProviderCredentialNotification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProviderCredentialNotification" ADD CONSTRAINT "ProviderCredentialNotification_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ProviderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProviderCredentialNotification" ADD CONSTRAINT "ProviderCredentialNotification_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ProviderCredentialDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProviderCredentialNotification" ADD CONSTRAINT "ProviderCredentialNotification_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ProviderCredentialReviewTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProviderCredentialNotification" ADD CONSTRAINT "ProviderCredentialNotification_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
