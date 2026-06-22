-- Provider credential approval policies
CREATE TABLE "ProviderCredentialPolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "approvalMode" TEXT NOT NULL DEFAULT 'STRICT',
    "requiredDocumentTypes" JSONB NOT NULL DEFAULT '["LICENSE","ID_DOCUMENT","INSURANCE"]',
    "optionalDocumentTypes" JSONB,
    "expiryWarningDays" INTEGER NOT NULL DEFAULT 30,
    "reviewDueDays" INTEGER NOT NULL DEFAULT 7,
    "autoCreateReviewTasks" BOOLEAN NOT NULL DEFAULT true,
    "autoQueueExpiryReminders" BOOLEAN NOT NULL DEFAULT false,
    "blockApprovalWhenExpired" BOOLEAN NOT NULL DEFAULT true,
    "blockApprovalWhenMissingRequired" BOOLEAN NOT NULL DEFAULT true,
    "instructions" TEXT,
    "lastAction" TEXT,
    "lastActorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderCredentialPolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProviderCredentialPolicy_organizationId_code_key" ON "ProviderCredentialPolicy"("organizationId", "code");
CREATE INDEX "ProviderCredentialPolicy_organizationId_status_idx" ON "ProviderCredentialPolicy"("organizationId", "status");

ALTER TABLE "ProviderCredentialPolicy"
ADD CONSTRAINT "ProviderCredentialPolicy_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
