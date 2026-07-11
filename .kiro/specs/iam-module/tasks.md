# Implementation Plan: IAM Module

## Overview

Implement a centralized Identity & Access Management module within the CarePoint admin portal. The implementation extends the existing Express + Prisma API backend with new IAM-specific routes, services, and middleware, and adds a new `/portal/iam` section to the Next.js admin frontend with tab-based navigation across Users, Roles, Providers, Schedule, Availability, Invitations, and Audit sub-modules.

## Tasks

- [x] 1. Data layer and schema setup
  - [x] 1.1 Add Prisma schema models for Invitation, PublishedSlot, and TimeOffBlock
    - Add `InvitationStatus` enum (PENDING, ACCEPTED, EXPIRED, REVOKED) and `SlotStatus` enum (AVAILABLE, HELD, BOOKED)
    - Add `Invitation` model with fields: id, organizationId, email, role, tokenHash (unique), status, expiresAt, acceptedAt, revokedAt, createdById, consumedById, timestamps
    - Add `PublishedSlot` model with fields: id, organizationId, providerId, templateId, startsAt, endsAt, service, location, capacity, bookedCount, status, timestamps
    - Add `TimeOffBlock` model with fields: id, organizationId, providerId, startsAt, endsAt, reason, createdById, timestamps
    - Add appropriate indexes and relations as specified in design
    - Run `npx prisma generate` to update the Prisma client
    - _Requirements: 5.2, 5.3, 5.4, 6.1, 6.2_

  - [x] 1.2 Create Zod validation schemas for IAM module
    - Create `services/api/src/modules/iam/schemas.ts`
    - Implement `createInvitationSchema`, `createAppointmentSchema`, `createTemplateSchema`, `createTimeOffSchema`, `changeRoleSchema`, `createUserSchema`, `cancelAppointmentSchema`, `auditExportSchema`
    - Follow validation constraints from design (e.g., duration 1-480, buffer 0-120, capacity 1-20, reason 1-500 chars)
    - _Requirements: 1.9, 4.10, 5.2, 5.9, 6.1_

- [x] 2. Organization scope middleware and access control
  - [x] 2.1 Implement organization scope middleware
    - Create `services/api/src/middleware/org-scope.ts`
    - SUPER_ADMIN bypasses org scoping
    - All other roles must have organizationId in JWT; reject with 401 if missing
    - Attach `req.orgFilter = { organizationId }` for use in handlers
    - _Requirements: 8.1, 8.2, 8.3, 8.5, 8.7_

  - [ ]* 2.2 Write property test for organization boundary enforcement
    - **Property 1: Organization Boundary Enforcement**
    - **Validates: Requirements 1.2, 1.8, 3.6, 4.11, 5.6, 8.1, 8.2, 8.5**

  - [x] 2.3 Implement permission-before-scope evaluation order
    - Ensure existing RBAC middleware (`services/api/src/middleware/rbac.ts`) runs before org-scope middleware in route chains
    - If permission check fails, return 403 without evaluating org scope
    - _Requirements: 8.4, 8.8_

  - [ ]* 2.4 Write property test for permission check before organization scope
    - **Property 20: Permission Check Before Organization Scope**
    - **Validates: Requirements 8.4, 8.8**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Invitation service and routes
  - [x] 4.1 Implement invitation service
    - Create `services/api/src/modules/iam/invitation.service.ts`
    - Implement `createInvitation()`: generate 32-byte crypto token, hash before storage, validate email not already active user, validate Company_Admin cannot assign SUPER_ADMIN
    - Implement `acceptInvitation()`: validate token not expired/consumed/revoked, create user with configured role and org, mark invitation as ACCEPTED
    - Implement `revokeInvitation()`: mark invitation as REVOKED
    - Implement `listInvitations()`: with org-scoped filtering and status display
    - Write audit entries for creation, acceptance, expiration, and revocation
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.9, 6.10, 6.11, 6.12_

  - [x] 4.2 Implement invitation routes
    - Create `services/api/src/modules/iam/invitation.routes.ts`
    - `POST /api/iam/invitations` — Create invitation (authenticated)
    - `GET /api/iam/invitations` — List invitations (authenticated, org-scoped)
    - `PATCH /api/iam/invitations/:id/revoke` — Revoke invitation (authenticated)
    - `POST /api/iam/invitations/:token/accept` — Accept invitation (public endpoint)
    - Wire up auth, RBAC, org-scope middleware and Zod validation
    - _Requirements: 6.1, 6.3, 6.7, 6.8, 6.9_

  - [ ]* 4.3 Write property tests for invitation lifecycle
    - **Property 9: Invitation Token Acceptance Validation**
    - **Property 10: Invitation Acceptance Creates Correct User**
    - **Property 11: Cannot Invite Existing Active User**
    - **Property 12: SUPER_ADMIN Role Escalation Prevention**
    - **Property 24: Invitation Token Security**
    - **Validates: Requirements 6.3, 6.4, 6.5, 6.6, 6.9, 6.10, 6.11**

- [x] 5. User management and role assignment enhancements
  - [x] 5.1 Extend admin-users routes for IAM user management
    - Enhance existing `services/api/src/modules/admin-users/` routes to support: paginated user list (20/page, sorted by createdAt desc), search filter (case-insensitive partial match on name/email/role), user creation with validation, status management (ACTIVE/SUSPENDED/ARCHIVED)
    - On status change to SUSPENDED: revoke all refresh tokens, set deactivatedAt
    - Enforce org-scope for Company_Admin (create/read within own org only)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9_

  - [ ]* 5.2 Write property test for text search filter
    - **Property 8: Text Search Filter Correctness**
    - **Validates: Requirements 1.7**

  - [x] 5.3 Implement role change with audit and session revocation
    - Add `PATCH /api/access/users/:id/role` endpoint (or extend existing access module)
    - Validate role change with reason (1-500 chars), check last COMPANY_ADMIN protection, prevent Company_Admin from assigning SUPER_ADMIN
    - Revoke all refresh tokens for affected user on role change
    - Write audit entry with previous role, new role, and reason
    - _Requirements: 2.3, 2.4, 2.5, 2.6, 2.8_

  - [ ]* 5.4 Write property tests for role assignment rules
    - **Property 12: SUPER_ADMIN Escalation Prevention**
    - **Property 13: Last COMPANY_ADMIN Protection**
    - **Property 14: Role Change Revokes Sessions**
    - **Validates: Requirements 2.4, 2.5, 2.8**

  - [x] 5.5 Implement access-review endpoint
    - Add `GET /api/iam/access-review` endpoint
    - Return users with SUPER_ADMIN or COMPANY_ADMIN role whose last role certification is older than 90 days
    - _Requirements: 2.7_

  - [ ]* 5.6 Write property test for access review stale certifications
    - **Property 19: Access Review Returns Stale Certifications**
    - **Validates: Requirements 2.7**

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Provider management enhancements
  - [x] 7.1 Extend admin-users provider endpoints for IAM
    - Enhance `services/api/src/modules/admin-users/` or create provider-specific sub-routes
    - Paginated provider list with name, specialty, license, onboarding status, credential summary
    - Provider detail: credential documents with verification status, review tasks, onboarding history
    - Provider creation (User + ProviderProfile + DRAFT onboarding state)
    - Organization-scoped access for Company_Admin
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6_

  - [x] 7.2 Implement credential verification status computation
    - Create utility function to compute VALID/EXPIRING_SOON/EXPIRED based on expiresAt and current date (30-day threshold)
    - Apply to provider list and detail views
    - _Requirements: 3.7_

  - [ ]* 7.3 Write property test for credential verification status
    - **Property 5: Credential Verification Status Computation**
    - **Validates: Requirements 3.7**

  - [x] 7.4 Implement onboarding state machine
    - Enforce allowed transitions: DRAFT → READY_FOR_REVIEW, READY_FOR_REVIEW → APPROVED | REJECTED | REQUEST_CHANGES, REQUEST_CHANGES → READY_FOR_REVIEW
    - Record decision note, reviewing actor, and timestamp
    - Reject invalid transitions with descriptive error
    - _Requirements: 3.5, 3.8_

  - [ ]* 7.5 Write property test for onboarding state machine
    - **Property 6: Onboarding State Machine Transitions**
    - **Validates: Requirements 3.5, 3.8**

- [x] 8. Schedule management service and routes
  - [x] 8.1 Implement schedule service with conflict detection
    - Create `services/api/src/modules/iam/schedule.service.ts`
    - Implement `checkConflicts()`: detect overlapping non-cancelled appointments for same provider
    - Implement `validateBookableWindow()`: ensure 06:00–23:00 UTC
    - Implement `createAppointment()`: validate conflicts + bookable window, create appointment, write audit
    - Implement `rescheduleAppointment()`: validate new time, update startsAt/endsAt, audit with old/new times
    - Implement `cancelAppointment()`: require reason (1-500 chars), set status CANCELLED, write audit
    - _Requirements: 4.7, 4.8, 4.9, 4.10_

  - [x] 8.2 Implement schedule routes
    - Create `services/api/src/modules/iam/schedule.routes.ts`
    - `GET /api/iam/schedules/:providerId/appointments` — List provider appointments (org-scoped)
    - `POST /api/iam/schedules/:providerId/appointments` — Create appointment
    - `PATCH /api/iam/schedules/appointments/:id` — Reschedule
    - `PATCH /api/iam/schedules/appointments/:id/cancel` — Cancel
    - Provider role can only access own schedule
    - _Requirements: 4.1, 4.2, 4.3, 4.6, 4.11_

  - [ ]* 8.3 Write property tests for appointment scheduling
    - **Property 7: Appointment Conflict Detection and Bookable Window**
    - **Property 21: Cancellation Reason Validation**
    - **Validates: Requirements 4.7, 4.8, 4.9, 4.10**

- [x] 9. Availability management service and routes
  - [x] 9.1 Implement availability service
    - Create `services/api/src/modules/iam/availability.service.ts`
    - Implement `createTemplate()`: validate inputs (name min 2, duration 1-480, buffer 0-120, capacity 1-20)
    - Implement `publishTemplate()`: generate slots for 21-day horizon, skip conflicts with booked appointments
    - Implement `createTimeOff()`: remove AVAILABLE slots in time-off range, reject removal of held/booked slots
    - Implement `updatePublishedTemplate()`: remove future unbooked slots, regenerate from updated pattern, preserve booked slots
    - Write audit entries for publish and time-off actions
    - _Requirements: 5.2, 5.3, 5.4, 5.8, 5.9, 5.10_

  - [x] 9.2 Implement availability routes
    - Create `services/api/src/modules/iam/availability.routes.ts`
    - `GET /api/iam/availability/:providerId/templates` — List templates
    - `POST /api/iam/availability/:providerId/templates` — Create template
    - `PATCH /api/iam/availability/templates/:id` — Update template
    - `POST /api/iam/availability/templates/:id/publish` — Publish template
    - `POST /api/iam/availability/:providerId/time-off` — Create time-off block
    - `GET /api/iam/availability/:providerId/slots` — List published slots
    - Provider role restricted to own templates (403 otherwise)
    - _Requirements: 5.1, 5.5, 5.6, 5.7_

  - [ ]* 9.3 Write property tests for availability management
    - **Property 15: Schedule Template Validation**
    - **Property 16: Slot Generation Covers Planning Horizon**
    - **Property 17: Time-Off Removes Only Available Slots**
    - **Property 18: Template Modification Preserves Booked Slots**
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.8, 5.9**

- [x] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Audit log enhancements
  - [x] 11.1 Enhance audit log endpoints for IAM
    - Extend existing `services/api/src/modules/audit/` routes
    - Paginated list (50/page, reverse chronological) with actor, action, resource, timestamp, change summary
    - Filters: action type, resource type, actor, date range (AND logic, default 30 days, max 365 days)
    - Organization-scoped for Company_Admin, cross-org with optional filter for Super_Admin
    - Empty state when no results match
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.9_

  - [x] 11.2 Implement audit log export
    - Add `POST /api/admin/audit/export` endpoint
    - Support JSON and CSV formats, max 10,000 entries per export
    - Include metadata header (export purpose, actor name/id, generation timestamp)
    - Return error if result set exceeds 10,000 entries
    - _Requirements: 7.5, 7.6_

  - [x] 11.3 Implement audit detail view endpoint
    - Add `GET /api/admin/audit/:id` endpoint
    - Return full structured change data and resource navigation link
    - Handle deleted resources (flag as inactive)
    - _Requirements: 7.8_

  - [ ]* 11.4 Write property tests for audit filtering and export
    - **Property 22: Audit Filter AND Combination**
    - **Property 23: Audit Export Entry Limit**
    - **Validates: Requirements 7.4, 7.5, 7.6**

- [x] 12. Wire up IAM router and register module
  - [x] 12.1 Create IAM module router and register all sub-routes
    - Create `services/api/src/modules/iam/iam.routes.ts` combining invitation, schedule, availability, and access-review routes
    - Register IAM router in `services/api/src/app.ts` at `/api/iam`
    - Ensure auth + RBAC + org-scope middleware applied at router level
    - _Requirements: 8.1, 8.4_

- [x] 13. Checkpoint - Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Frontend - IAM layout and navigation
  - [x] 14.1 Create IAM layout with tab navigation
    - Create `apps/admin/src/app/portal/iam/layout.tsx`
    - Implement shared layout with tabs: Usuarios, Roles y Permisos, Proveedores, Agenda, Disponibilidad, Invitaciones, Auditoría
    - Apply role-based visibility (hide tabs user cannot access)
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.7, 7.1_

- [x] 15. Frontend - Users page
  - [x] 15.1 Implement Users page with paginated table and search
    - Create `apps/admin/src/app/portal/iam/users/page.tsx`
    - Paginated table (20 items/page) with columns: full name, email, role, organization, status, creation date
    - Text search filter (case-insensitive match on name/email/role)
    - Organization column visible only for Super_Admin
    - Sorted by creation date descending
    - _Requirements: 1.1, 1.2, 1.3, 1.7_

  - [x] 15.2 Implement user creation and status management dialogs
    - Create user dialog with fields: first name, last name, email, role, organization (Super_Admin only)
    - Status management controls (ACTIVE/SUSPENDED/ARCHIVED)
    - Validation error display for duplicate email, missing required fields
    - _Requirements: 1.4, 1.5, 1.6, 1.9_

- [x] 16. Frontend - Roles and Permissions page
  - [x] 16.1 Implement Roles and Permissions page
    - Create `apps/admin/src/app/portal/iam/roles/page.tsx`
    - Role list with descriptions and permission assignments
    - Permission matrix grid showing roles vs permissions
    - Role assignment dialog with reason field (1-500 chars)
    - Access review list showing users needing re-certification
    - _Requirements: 2.1, 2.2, 2.3, 2.6, 2.7_

- [x] 17. Frontend - Providers page
  - [x] 17.1 Implement Providers page with list and detail views
    - Create `apps/admin/src/app/portal/iam/providers/page.tsx`
    - Provider list with name, specialty, license, onboarding status badges, credential summary
    - Credential verification badges (VALID/EXPIRING_SOON/EXPIRED)
    - Provider detail drawer with credential documents, review tasks, onboarding history
    - Onboarding state transition controls
    - Provider creation dialog
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.7_

- [x] 18. Frontend - Schedule page (Calendar view)
  - [x] 18.1 Implement Schedule page with calendar view
    - Create `apps/admin/src/app/portal/iam/schedule/page.tsx`
    - Integrate react-big-calendar with day/week/month views (default: week)
    - Provider selector (org-scoped for Company_Admin)
    - Display appointments with start/end time, patient, service, location, status
    - Color-coded status indicators (REQUESTED, CONFIRMED, CANCELLED, COMPLETED, NO_SHOW)
    - Navigation controls (forward, backward, today)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 18.2 Implement appointment creation, reschedule, and cancel dialogs
    - Create appointment dialog with time slot, patient, service, location fields
    - Reschedule dialog showing old/new time with conflict validation
    - Cancel dialog requiring reason (1-500 chars)
    - Error display for conflicts and bookable window violations
    - _Requirements: 4.7, 4.8, 4.9, 4.10_

- [x] 19. Frontend - Availability page
  - [x] 19.1 Implement Availability page with weekly grid and template management
    - Create `apps/admin/src/app/portal/iam/availability/page.tsx`
    - Weekly grid view showing time blocks by day with service type, location, duration, status
    - Template creation form with fields: name, day patterns, time ranges, service type, location, modes, duration, buffer, capacity
    - Validation feedback for invalid ranges
    - Publish/unpublish controls
    - Time-off block creation dialog
    - Slot preview display
    - _Requirements: 5.1, 5.2, 5.7, 5.9_

- [x] 20. Frontend - Invitations page
  - [x] 20.1 Implement Invitations page
    - Create `apps/admin/src/app/portal/iam/invitations/page.tsx`
    - Invitation list with status badges (PENDING, ACCEPTED, EXPIRED, REVOKED), recipient email, role, sent date, expiration date
    - Create invitation dialog with email, role, and expiration fields
    - Revoke action with confirmation dialog
    - Org-scoped for Company_Admin, all orgs for Super_Admin
    - _Requirements: 6.7, 6.8, 6.11_

- [x] 21. Frontend - Audit page
  - [x] 21.1 Implement Audit page with filters, detail view, and export
    - Create `apps/admin/src/app/portal/iam/audit/page.tsx`
    - Paginated table (50/page, newest first) with actor, action, resource, timestamp (ISO 8601), change summary
    - Filter controls: action type, resource type, actor, date range (default 30 days, max 365 days)
    - Export dialog (JSON/CSV) with purpose field
    - Detail view with structured change data and resource navigation link (inactive for deleted resources)
    - Empty state message when no results match filters
    - Organization filter for Super_Admin
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.8, 7.9_

- [x] 22. Frontend - Invitation acceptance page (public)
  - [x] 22.1 Implement invitation acceptance page
    - Create `apps/admin/src/app/auth/invite/[token]/page.tsx`
    - Accept invitation token, display status (success, expired, already used, revoked)
    - Redirect to login on success
    - Error messaging for invalid/expired/consumed tokens
    - _Requirements: 6.3, 6.5, 6.6_

- [x] 23. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 24. Integration and audit completeness wiring
  - [x] 24.1 Ensure all IAM mutations write audit entries
    - Verify audit logging in: user creation, role changes, status changes, invitation events, appointment modifications, schedule changes, availability changes
    - Ensure audit entries include actor, action, resource, org, and change details
    - Wire `writeAuditLog()` calls into any handlers missing audit coverage
    - _Requirements: 7.7, 6.12, 5.10, 4.9, 4.10, 2.3, 2.6_

  - [ ]* 24.2 Write property test for audit completeness
    - **Property 2: IAM Mutations Produce Audit Entries**
    - **Validates: Requirements 2.3, 2.6, 4.9, 4.10, 5.10, 6.12, 7.7**

  - [x] 24.3 Ensure access-denied events are audit logged
    - Log all 403 Forbidden responses as audit entries with: denied actor, requested resource, attempted action, denial reason
    - Ensure logging occurs within 1 second of denial
    - _Requirements: 8.6_

- [x] 25. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation of backend and frontend work
- Property tests validate universal correctness properties defined in the design document
- Unit tests validate specific examples and edge cases
- The implementation leverages existing infrastructure (auth middleware, RBAC, Prisma models) and extends rather than duplicates
- All code examples use TypeScript matching the existing project stack (Express + Prisma backend, Next.js frontend)
- react-big-calendar is used for the schedule calendar view as specified in the design

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "2.3"] },
    { "id": 2, "tasks": ["2.2", "2.4", "4.1", "5.1", "7.1", "7.2"] },
    { "id": 3, "tasks": ["4.2", "4.3", "5.2", "5.3", "7.3", "7.4"] },
    { "id": 4, "tasks": ["5.4", "5.5", "7.5", "8.1"] },
    { "id": 5, "tasks": ["5.6", "8.2", "8.3", "9.1"] },
    { "id": 6, "tasks": ["9.2", "9.3", "11.1"] },
    { "id": 7, "tasks": ["11.2", "11.3", "11.4", "12.1"] },
    { "id": 8, "tasks": ["14.1"] },
    { "id": 9, "tasks": ["15.1", "16.1", "17.1", "20.1", "22.1"] },
    { "id": 10, "tasks": ["15.2", "18.1", "19.1", "21.1"] },
    { "id": 11, "tasks": ["18.2"] },
    { "id": 12, "tasks": ["24.1", "24.3"] },
    { "id": 13, "tasks": ["24.2"] }
  ]
}
```
