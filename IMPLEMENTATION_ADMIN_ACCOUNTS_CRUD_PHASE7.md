# Admin Accounts CRUD Phase 7 — Provider Credential Document Governance

## Scope
Phase 7 extends the Admin Patient & Provider Accounts workspace with provider credential document management. It builds on the Phase 6 onboarding state and adds structured tracking for license, identity, insurance, certification, degree, and other credential documents.

## Backend changes
- Added Prisma enums:
  - `CredentialDocumentType`
  - `CredentialDocumentStatus`
- Added Prisma model:
  - `ProviderCredentialDocument`
- Added migration:
  - `services/api/prisma/migrations/20260428100000_provider_credential_documents/migration.sql`
- Extended provider account mapping to return:
  - `credentialDocuments`
  - `credentialSummary`
- Added credential document endpoints:
  - `GET /api/admin/users/providers/:providerId/credentials`
  - `POST /api/admin/users/providers/:providerId/credentials`
  - `PUT /api/admin/users/providers/:providerId/credentials/:documentId`
  - `PATCH /api/admin/users/providers/:providerId/credentials/:documentId/status`
  - `DELETE /api/admin/users/providers/:providerId/credentials/:documentId`

## Admin UI changes
- Provider rows now include a credential document panel.
- Admins can add, edit, verify, reject, mark expired, or delete provider credential documents.
- Required credential coverage is summarized for:
  - professional license
  - identity document
  - insurance document
- Expiry status is surfaced for expired and soon-expiring documents.
- Provider readiness percentage now includes credential document completeness.

## Governance and audit
The following audit actions are emitted:
- `admin.provider.credential_document.created`
- `admin.provider.credential_document.updated`
- `admin.provider.credential_document.verified`
- `admin.provider.credential_document.rejected`
- `admin.provider.credential_document.status_changed`
- `admin.provider.credential_document.deleted`

## Operational notes
- This phase does not upload binary files directly. `documentUrl` is designed to store a secure object key or signed-storage reference from the platform storage layer.
- No `.env` file is included.
- If a storage provider is introduced later, add the needed environment variables manually as agreed.

## Validation performed
- TypeScript/TSX syntax transpile validation passed for the modified Admin page and backend route.
- Prisma migration and schema files are included for database/client regeneration.
