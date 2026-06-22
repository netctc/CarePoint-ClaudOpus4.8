-- Provider credential document governance for Admin account management Phase 7.
CREATE TYPE "CredentialDocumentType" AS ENUM ('LICENSE', 'ID_DOCUMENT', 'INSURANCE', 'CERTIFICATION', 'DEGREE', 'OTHER');
CREATE TYPE "CredentialDocumentStatus" AS ENUM ('MISSING', 'UPLOADED', 'VERIFIED', 'REJECTED', 'EXPIRED');

CREATE TABLE "ProviderCredentialDocument" (
  "id" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "type" "CredentialDocumentType" NOT NULL,
  "title" TEXT NOT NULL,
  "status" "CredentialDocumentStatus" NOT NULL DEFAULT 'UPLOADED',
  "documentUrl" TEXT,
  "fileName" TEXT,
  "referenceNumber" TEXT,
  "issuedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "verifiedById" TEXT,
  "notes" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProviderCredentialDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProviderCredentialDocument_organizationId_providerId_idx"
  ON "ProviderCredentialDocument"("organizationId", "providerId");

CREATE INDEX "ProviderCredentialDocument_type_status_expiresAt_idx"
  ON "ProviderCredentialDocument"("type", "status", "expiresAt");

ALTER TABLE "ProviderCredentialDocument"
  ADD CONSTRAINT "ProviderCredentialDocument_providerId_fkey"
  FOREIGN KEY ("providerId") REFERENCES "ProviderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProviderCredentialDocument"
  ADD CONSTRAINT "ProviderCredentialDocument_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProviderCredentialDocument"
  ADD CONSTRAINT "ProviderCredentialDocument_verifiedById_fkey"
  FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
