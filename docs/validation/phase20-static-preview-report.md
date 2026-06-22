# Phase 20 Merge Readiness Report

Generated: 2026-04-29T20:16:30.165Z
Workspace: `/tmp/phase20_merged`
Status: **READY_WITH_WARNINGS**

## Summary

- Total checks: 50
- Passed: 49
- Errors: 0
- Warnings: 1

## Warnings

### PRISMA_VERSION_ALIGNMENT: Root/API Prisma major versions are aligned

- Status: FAIL
- Detail: root prisma=^7.6.0, root @prisma/client=^7.6.0, api prisma=^5.18.0, api @prisma/client=^5.18.0
- Recommendation: Align Prisma CLI and @prisma/client major versions before production migration. Current codebase historically mixes Prisma 7 at root and Prisma 5 in services/api.

## Passed checks

- ADMIN_ACCOUNTS_PAGE: Admin patient/provider account governance page
- ADMIN_ORGS_PAGE: Admin organization management page
- ADMIN_AUDIT_LOGS_PAGE: Admin audit logs page
- ADMIN_AUDIT_EXPORT_PROXY: Admin filtered audit export proxy
- ADMIN_USERS_ROUTES: Backend admin-users route module
- PRISMA_SCHEMA: Prisma schema
- PROVIDER_ROOT_REDIRECT: Provider root route
- PROVIDER_SIGNIN_PAGE: Provider sign-in page
- PROVIDER_SIGNIN_FORM: Provider sign-in form
- PROVIDER_TOP_HEADER: Provider portal top header
- PROVIDER_API_CLIENT: Provider API client
- PRISMA_ACCOUNT_STATUS: Account lifecycle enum
- PRISMA_ONBOARDING_STATUS: Provider onboarding status enum
- PRISMA_CREDENTIAL_DOCUMENT: ProviderCredentialDocument model
- PRISMA_REVIEW_TASK: ProviderCredentialReviewTask model
- PRISMA_NOTIFICATION: ProviderCredentialNotification model
- PRISMA_PROVIDER_RELATIONS: Provider profile credential relations
- PRISMA_ORG_RELATIONS: Organization credential governance relations
- MIGRATION_20260428100000_provider_credential_documents: Migration folder 20260428100000_provider_credential_documents
- MIGRATION_20260428103000_provider_credential_review_tasks: Migration folder 20260428103000_provider_credential_review_tasks
- MIGRATION_20260428110000_provider_credential_notifications: Migration folder 20260428110000_provider_credential_notifications
- MIGRATION_20260428113000_provider_credential_notification_dispatch: Migration folder 20260428113000_provider_credential_notification_dispatch
- MIGRATION_ORDER: Credential governance migration order
- ROUTE_PATIENTS: Patient CRUD route surface
- ROUTE_PROVIDERS: Provider CRUD route surface
- ROUTE_ORGANIZATIONS: Organization management route surface
- ROUTE_BULK_STATUS: Bulk lifecycle route surface
- ROUTE_AUDIT_EXPORT: Filtered audit export route surface
- ROUTE_DATA_QUALITY: Data-quality route surface
- ROUTE_GOVERNANCE_SWEEP: Credential governance sweep route surface
- ROUTE_PROVIDER_ONBOARDING: Provider onboarding route surface
- ROUTE_CREDENTIAL_DOCS: Credential documents route surface
- ROUTE_REVIEW_TASKS: Credential review task route surface
- ROUTE_NOTIFICATIONS: Credential notifications route surface
- UI_ACCOUNT_AUDIT_LINKS: Account audit trail links visible
- UI_ORG_CREATE_MODIFY_DELETE: Organization create/modify/delete UI present
- UI_AUDIT_FILTERS: Audit page has filter/export support
- UI_ORG_OPTIONAL: Accounts page supports unassigned organization handling
- PROVIDER_ROOT_REDIRECTS_SIGNIN: Provider root redirects directly to sign-in
- PROVIDER_LANDING_BUTTONS_REMOVED: Provider landing buttons removed
- PROVIDER_LOGOUT_BUTTON: Provider top header has logout button
- PROVIDER_LOGOUT_API: Provider API client exposes logout
- PROVIDER_LOGIN_DEV_OTP: Provider sign-in preserves development OTP display
- DOC_PHASE13_MERGE: Phase 13 merge checklist
- DOC_PHASE17_MERGE: Phase 17 merge checklist
- DOC_PHASE19_MERGE: Phase 19 Provider logout merge checklist
- HTTP_PHASE17_ORGS: Organization API test file
- HTTP_PHASE19_LOGOUT: Provider logout API test file
- ENV_FILES_PRESENT_IN_WORKSPACE: Workspace .env files detected only as local deployment files
