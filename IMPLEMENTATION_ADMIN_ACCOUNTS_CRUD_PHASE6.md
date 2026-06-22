# Admin Accounts CRUD Phase 6 — Provider Credentialing / Onboarding Governance

## Scope
This phase extends the patient/provider account-management workspace with provider credentialing controls. It does not add new environment variables and does not require a new database table because it uses the existing `ProviderOnboardingState` Prisma model.

## Backend additions
- Extended provider list/export mapping with onboarding status, submitted/reviewed dates, decision note, and checklist data.
- Provider create/import now initializes a provider onboarding state in `DRAFT` unless another valid onboarding status is supplied.
- Provider update can synchronize specialty, license, services, and credentialing note into onboarding state.
- Added endpoint: `PATCH /api/admin/users/providers/:providerId/onboarding`.
- Added audit events for provider credentialing updates, approvals, and rejections.

## Admin UI additions
- Provider create form includes credentialing status and note fields.
- Provider edit rows include credentialing status and note fields.
- Provider rows show a credentialing panel with readiness percentage, onboarding badge, submitted/reviewed dates, checklist summary, and a quick update form.
- CSV provider exports now include onboarding columns.

## Business rules
- Organization scope is enforced before credentialing changes.
- Status values are constrained to `DRAFT`, `READY_FOR_REVIEW`, `REQUEST_CHANGES`, `APPROVED`, and `REJECTED`.
- Approval/rejection/request-changes actions set a reviewed timestamp.
- Ready-for-review actions set a submitted timestamp.
- Provider deletion still removes onboarding state only after dependency checks pass.

## Validation performed
- TypeScript/TSX transpile syntax checks passed for the modified backend route and Admin account page.

## Notes
- No `.env` file is included.
- Full application build was not executed because the extracted workspace does not include installed dependencies.
