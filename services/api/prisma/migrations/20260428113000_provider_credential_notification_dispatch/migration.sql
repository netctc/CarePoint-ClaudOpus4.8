-- Phase 10: provider credential notification dispatch tracking.
-- Adds lightweight delivery metadata without requiring a specific email/SMS vendor.

ALTER TABLE "ProviderCredentialNotification"
ADD COLUMN IF NOT EXISTS "deliveryProvider" TEXT,
ADD COLUMN IF NOT EXISTS "deliveryProviderMessageId" TEXT,
ADD COLUMN IF NOT EXISTS "dispatchAttemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "lastDispatchAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "ProviderCredentialNotification_dispatch_idx"
ON "ProviderCredentialNotification"("organizationId", "status", "lastDispatchAt");
