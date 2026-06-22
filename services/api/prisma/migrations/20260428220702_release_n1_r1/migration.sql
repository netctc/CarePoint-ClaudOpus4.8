-- DropIndex
DROP INDEX "User_organizationId_status_idx";

-- DropIndex
DROP INDEX "User_status_idx";

-- RenameIndex
ALTER INDEX "ProviderCredentialNotification_dispatch_idx" RENAME TO "ProviderCredentialNotification_organizationId_status_lastDi_idx";

-- RenameIndex
ALTER INDEX "ProviderCredentialNotification_organizationId_status_scheduledF" RENAME TO "ProviderCredentialNotification_organizationId_status_schedu_idx";

-- RenameIndex
ALTER INDEX "ProviderCredentialReviewTask_organizationId_status_priority_due" RENAME TO "ProviderCredentialReviewTask_organizationId_status_priority_idx";
