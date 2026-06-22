# Admin Accounts CRUD Phase 8 — Provider Credential Review Workflow

## Scope
This phase extends provider credential document governance with an operational review workflow for credentialing teams. It adds reviewer assignment, task queues, due dates, task status tracking, priority handling, and automatic task creation/closure around provider credential documents.

## Backend additions
- Added Prisma enums:
  - `ProviderCredentialReviewTaskStatus`: `OPEN`, `IN_REVIEW`, `BLOCKED`, `COMPLETED`, `CANCELLED`
  - `ProviderCredentialReviewPriority`: `LOW`, `NORMAL`, `HIGH`, `URGENT`
- Added Prisma model:
  - `ProviderCredentialReviewTask`
- Added migration:
  - `20260428103000_provider_credential_review_tasks`
- Added API endpoints:
  - `GET /api/admin/users/credential-review-tasks`
  - `POST /api/admin/users/providers/:providerId/credential-review-tasks`
  - `PATCH /api/admin/users/credential-review-tasks/:taskId`

## Workflow behavior
- When a provider credential document is uploaded or updated to a non-final state, the API creates an open review task if one does not already exist.
- When a credential document is verified, related active review tasks are completed.
- When a credential document is rejected or expired, related active review tasks are blocked with the decision reason.
- Admins can manually create review tasks for general provider onboarding or for a specific credential document.
- Tasks can be assigned to admin/support users by email or user ID, scoped to the current organization when applicable.

## Admin UI additions
- Added global credential review queue on `/portal/accounts`.
- Added per-provider review task panel.
- Added task forms for creating, updating, assigning, prioritizing, blocking, completing, cancelling, and reopening review tasks.
- Added badges for review status and priority.

## Audit events
- `admin.provider.credential_review_task.created`
- `admin.provider.credential_review_task.updated`
- `admin.provider.credential_review_task.completed`
- `admin.provider.credential_review_task.cancelled`

## Merge notes
Apply this package after Phase 7. Run Prisma migration/generate before starting the API. No `.env` file is included.
