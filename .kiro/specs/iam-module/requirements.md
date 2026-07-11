# Requirements Document

## Introduction

This document specifies the requirements for a centralized Identity & Access Management (IAM) module within the CarePoint admin portal. The IAM module consolidates user management, role-based access control, provider professional information, scheduling, availability, invitation-based onboarding, and audit logging into a single unified interface. The module builds upon existing infrastructure (User model, RBAC middleware, ProviderProfile, Appointments, ProviderScheduleTemplate, AuditLog) and surfaces these capabilities through a cohesive admin UI with organization-scoped access control.

## Glossary

- **IAM_Module**: The centralized Identity & Access Management section within the CarePoint admin portal that provides unified management of users, roles, providers, schedules, availability, invitations, and audit logs.
- **CarePoint_System**: The overall healthcare platform consisting of admin, provider, and patient applications backed by a shared API.
- **Admin_Portal**: The Next.js application at `apps/admin` (port 3001) serving administrative functions.
- **API_Service**: The Express + Prisma backend at `services/api` providing all data operations.
- **Super_Admin**: A user with role SUPER_ADMIN who has full platform-wide control across all organizations.
- **Company_Admin**: A user with role COMPANY_ADMIN who manages users and operations within a single organization.
- **Provider**: A healthcare professional (role PROVIDER, NURSE, PHARMACIST, or LAB_TECH) with a ProviderProfile.
- **Organization**: A tenant entity that scopes all data access; users, providers, and appointments belong to an organization.
- **Permission**: A granular access right (e.g., `users:manage`, `schedules:view`) assigned to roles.
- **Role_Assignment**: The binding between a user and a role, potentially with additional scope and MFA status.
- **Schedule_Template**: A ProviderScheduleTemplate record defining recurring weekly availability patterns.
- **Published_Slot**: A concrete bookable time slot generated from a schedule template or created manually.
- **Invitation**: A secure, time-limited link sent via email to onboard a new user into the platform.
- **Audit_Entry**: An AuditLog record capturing an action, the actor, the resource, and contextual details.
- **Calendar_View**: A Google Calendar-like UI component displaying appointments and availability slots across a timeline.

## Requirements

### Requirement 1: Unified User List (Usuarios)

**User Story:** As an administrator, I want to view and manage all system accounts from a single list, so that I can efficiently oversee all users in the platform or within my organization.

#### Acceptance Criteria

1. WHEN an authenticated Super_Admin navigates to the IAM_Module users section, THE Admin_Portal SHALL display all user accounts across all organizations in a paginated table with a default page size of 20 items, sorted by creation date descending.
2. WHEN an authenticated Company_Admin navigates to the IAM_Module users section, THE Admin_Portal SHALL display only user accounts belonging to the Company_Admin's organization.
3. THE Admin_Portal SHALL display for each user: full name, email, role, organization name, account status (ACTIVE, SUSPENDED, ARCHIVED), and creation date.
4. WHEN a Super_Admin creates a new user account providing full name, email, role, and organization assignment, THE API_Service SHALL validate that the email is unique across the platform, create the user record, and generate a password hash.
5. WHEN a Company_Admin creates a new user account, THE API_Service SHALL create the user within the Company_Admin's own organization only.
6. WHEN an administrator updates a user's account status to SUSPENDED, THE API_Service SHALL revoke all active refresh tokens for that user and set the deactivatedAt timestamp.
7. WHEN an administrator applies a text search filter, THE Admin_Portal SHALL filter the user list by case-insensitive partial match on name, email, or role against the search term.
8. IF a Company_Admin attempts to access or modify a user belonging to a different organization, THEN THE API_Service SHALL return a 403 Forbidden response.
9. IF a user creation request is missing required fields (full name, email, role) or specifies an email that already exists, THEN THE API_Service SHALL reject the request with an error response indicating the specific validation failure without creating any record.

### Requirement 2: Centralized Roles and Permissions (Roles y Permisos)

**User Story:** As an administrator, I want to configure roles and permissions centrally, so that I can control which actions each user type can perform across the platform.

#### Acceptance Criteria

1. WHEN an authenticated administrator navigates to the IAM_Module roles section, THE Admin_Portal SHALL display the list of system roles with their descriptions and permission assignments.
2. WHEN an authenticated administrator navigates to the IAM_Module roles section, THE Admin_Portal SHALL display the permission matrix showing which roles have access to which platform permissions.
3. WHEN a Super_Admin assigns a new role to a user, THE API_Service SHALL update the user's role and write an audit entry with the previous role, new role, and a reason field of 1 to 500 characters.
4. IF a Company_Admin attempts to assign the SUPER_ADMIN role, THEN THE API_Service SHALL reject the request with a 403 Forbidden response.
5. IF a Super_Admin attempts to change a user's role and the change would result in zero COMPANY_ADMIN users remaining in that user's organization, THEN THE API_Service SHALL reject the request with an error response indicating the organization must retain at least one COMPANY_ADMIN.
6. WHEN a Company_Admin assigns a role to a user within the same organization, THE API_Service SHALL update the user's role provided the target role is not SUPER_ADMIN, and write an audit entry with the previous role, new role, and reason.
7. THE API_Service SHALL expose an access-review endpoint that lists users holding the SUPER_ADMIN or COMPANY_ADMIN role whose last role certification is older than 90 days.
8. WHEN a role change is applied, THE API_Service SHALL revoke existing sessions for the affected user to force re-authentication with the new role.

### Requirement 3: Provider Management (Proveedores)

**User Story:** As an administrator, I want to view and manage provider professional information, so that I can ensure all healthcare professionals have correct profiles and credentials.

#### Acceptance Criteria

1. WHEN an authenticated administrator navigates to the IAM_Module providers section, THE Admin_Portal SHALL display a paginated list of providers with name, specialty, license number, onboarding status (DRAFT, READY_FOR_REVIEW, REQUEST_CHANGES, APPROVED, or REJECTED), and credential summary.
2. WHEN an administrator selects a specific provider, THE Admin_Portal SHALL display the provider's full profile including credential documents with their verification status, review tasks with priority and status, and the current onboarding state with decision history.
3. WHEN a Super_Admin creates a new provider, THE API_Service SHALL create a User record with a provider role, a ProviderProfile linked to the specified organization, and initialize the onboarding state as DRAFT.
4. WHEN a Company_Admin creates a new provider, THE API_Service SHALL create the provider within the Company_Admin's own organization only.
5. WHEN an administrator updates a provider's onboarding status, THE API_Service SHALL record the decision note, the reviewing actor, and the timestamp, and SHALL only permit transitions from DRAFT to READY_FOR_REVIEW, from READY_FOR_REVIEW to APPROVED, REJECTED, or REQUEST_CHANGES, and from REQUEST_CHANGES to READY_FOR_REVIEW.
6. IF a Company_Admin attempts to manage a provider belonging to a different organization, THEN THE API_Service SHALL return a 403 Forbidden response.
7. THE Admin_Portal SHALL display credential verification status for each provider where VALID indicates the credential is verified and the expiresAt date is more than 30 days in the future, EXPIRING_SOON indicates the credential is verified and the expiresAt date is within 30 days, and EXPIRED indicates the expiresAt date has passed.
8. IF an administrator attempts an onboarding status transition that is not permitted by the allowed transition rules, THEN THE API_Service SHALL reject the request with an error message indicating the invalid transition.

### Requirement 4: Schedule Management (Agenda)

**User Story:** As an administrator, I want to view and manage provider visit schedules in a calendar view, so that I can oversee appointment distribution and resolve scheduling conflicts.

#### Acceptance Criteria

1. WHEN an authenticated administrator navigates to the IAM_Module schedule section, THE Admin_Portal SHALL display a calendar view showing appointments and published slots for the selected provider, defaulting to the week view mode.
2. WHEN a Super_Admin selects a provider from any organization, THE Admin_Portal SHALL display that provider's full schedule in the Calendar_View.
3. WHEN a Company_Admin views the schedule section, THE Admin_Portal SHALL display only providers belonging to the Company_Admin's organization in the provider selector.
4. THE Calendar_View SHALL display each appointment with start time, end time, patient name, service type, location, and status (one of: REQUESTED, CONFIRMED, CANCELLED, COMPLETED, NO_SHOW).
5. THE Calendar_View SHALL support day, week, and month view modes with navigation controls to move forward, backward, and return to the current date.
6. WHEN a Provider views their own schedule, THE Admin_Portal SHALL display only the Provider's own appointments and published slots.
7. WHEN an administrator creates a new appointment through the Calendar_View, THE API_Service SHALL validate that the time slot falls within the bookable window (06:00–23:00 UTC) and does not conflict with existing non-cancelled appointments for the same provider.
8. IF a conflict or bookable-window violation is detected during appointment creation or rescheduling, THEN THE API_Service SHALL reject the request with an error message indicating the reason for the conflict and preserve the original appointment state unchanged.
9. WHEN an administrator reschedules an appointment, THE API_Service SHALL update the startsAt and endsAt fields, validate no conflicts exist at the new time, and write an audit entry recording the previous and new time values.
10. WHEN an administrator cancels an appointment, THE API_Service SHALL require a cancellation reason (1 to 500 characters), set the appointment status to CANCELLED, and write an audit entry including the cancellation reason.
11. IF a Company_Admin attempts to view or modify an appointment for a provider belonging to a different organization, THEN THE API_Service SHALL return a 403 Forbidden response.

### Requirement 5: Availability Management (Disponibilidad)

**User Story:** As an administrator, I want to manage provider availability including weekly schedules, vacation blocks, and time-off periods, so that the booking system has accurate availability data.

#### Acceptance Criteria

1. WHEN an authenticated administrator navigates to the IAM_Module availability section, THE Admin_Portal SHALL display the provider's schedule templates showing weekly recurring patterns with template name, day-of-week entries, time ranges, service type, location, and status (DRAFT or PUBLISHED).
2. WHEN an administrator creates a new schedule template, THE API_Service SHALL validate and store the template with a name (minimum 2 characters), day-of-week patterns, time ranges, service type, location, service modes, appointment duration (1 to 480 minutes), buffer between appointments (0 to 120 minutes), and capacity per slot (1 to 20 concurrent bookings).
3. WHEN an administrator publishes a schedule template, THE API_Service SHALL generate published slots for a 21-day planning horizon starting from the current date, skipping any time ranges that conflict with existing booked appointments.
4. WHEN an administrator creates a time-off block specifying a start date-time and end date-time, THE API_Service SHALL remove all published slots that overlap with the time-off period, rejecting removal of any slot that has active holds or booked appointments.
5. WHEN a Provider manages their own availability, THE API_Service SHALL restrict access to only the Provider's own schedule templates and reject requests referencing other providers' templates with a 403 Forbidden response.
6. IF a Company_Admin attempts to manage availability for a provider in a different organization, THEN THE API_Service SHALL return a 403 Forbidden response.
7. THE Admin_Portal SHALL display a weekly grid view showing time blocks by day for the selected provider's recurring schedule, with each block indicating service type, location, duration, and availability status.
8. WHEN a published template is modified, THE API_Service SHALL remove future unpublished slots generated from that template and regenerate slots from the updated pattern for the remaining planning horizon, preserving any slots that have booked appointments.
9. IF a schedule template is submitted with a duration less than 1 minute or greater than 480 minutes, or a buffer greater than 120 minutes, or a capacity greater than 20, THEN THE API_Service SHALL reject the request with an error message indicating the invalid field and its allowed range.
10. WHEN a schedule template is published or a time-off block is created, THE API_Service SHALL write an audit entry recording the actor, affected provider, action performed, and the count of slots created or removed.

### Requirement 6: User Invitations (Invitaciones)

**User Story:** As an administrator, I want to onboard new users via secure invitation links, so that I can control platform access and ensure proper identity verification.

#### Acceptance Criteria

1. WHEN an administrator creates a new invitation, THE API_Service SHALL generate a unique, cryptographically secure token (minimum 32 bytes) with a configurable expiration period defaulting to 72 hours and bounded between 1 hour and 30 days.
2. WHEN an invitation is created, THE API_Service SHALL associate the invitation with the target email (validated as a well-formed email address), intended role, and organization.
3. WHEN a user accepts an invitation by navigating to the secure link, THE API_Service SHALL validate the token has not expired, has not been previously consumed, and has not been revoked.
4. WHEN a valid invitation token is consumed, THE API_Service SHALL create the user account with the pre-configured role and organization, and mark the invitation as consumed.
5. IF an invitation token has expired, THEN THE API_Service SHALL return an error indicating the invitation is no longer valid and suggest the administrator resend.
6. IF an invitation token has already been consumed, THEN THE API_Service SHALL return an error indicating the invitation has already been used.
7. WHEN a Super_Admin views the invitations section, THE Admin_Portal SHALL display all sent invitations across all organizations with status (PENDING, ACCEPTED, EXPIRED, REVOKED), recipient email, intended role, sent date, and expiration date.
8. WHEN a Company_Admin views the invitations section, THE Admin_Portal SHALL display only invitations belonging to the Company_Admin's organization with status, recipient email, intended role, sent date, and expiration date.
9. WHEN an administrator revokes a pending invitation, THE API_Service SHALL mark the invitation as REVOKED and prevent future acceptance.
10. IF an administrator attempts to create an invitation for an email address that already belongs to an active user account, THEN THE API_Service SHALL reject the request with an error indicating the user already exists.
11. IF a Company_Admin attempts to create an invitation with the SUPER_ADMIN role, THEN THE API_Service SHALL reject the request with a 403 Forbidden response.
12. THE API_Service SHALL write an audit entry for each invitation creation, acceptance, expiration, and revocation, including the actor, target email, intended role, and organization.

### Requirement 7: Audit Log (Auditoría)

**User Story:** As an administrator, I want to view a complete history of all actions performed in the platform, so that I can track changes, investigate incidents, and satisfy compliance requirements.

#### Acceptance Criteria

1. WHEN an authenticated administrator navigates to the IAM_Module audit section, THE Admin_Portal SHALL display audit entries in reverse chronological order (newest first) in a paginated table showing a maximum of 50 entries per page, with each entry displaying the actor name, action type, resource identifier, timestamp in ISO 8601 format, and a summary of the changes performed.
2. WHEN a Company_Admin views audit logs, THE Admin_Portal SHALL display only audit entries belonging to the Company_Admin's organization.
3. WHEN a Super_Admin views audit logs, THE Admin_Portal SHALL display audit entries across all organizations with optional organization filtering.
4. THE Admin_Portal SHALL provide filters for action type, resource type, actor, and date range, where all active filters are combined using AND logic, and the date range filter defaults to the last 30 days with a maximum selectable span of 365 days.
5. WHEN an administrator exports audit logs, THE API_Service SHALL generate a file in the administrator-selected format (JSON or CSV) limited to a maximum of 10,000 entries per export, including a metadata header containing the stated export purpose, the exporting actor's name and identifier, and the export generation timestamp.
6. IF an audit log export request matches more than 10,000 entries, THEN THE API_Service SHALL return an error indicating the result set exceeds the export limit and prompt the administrator to narrow the filter criteria.
7. THE API_Service SHALL write an audit entry for every user creation, role change, status change, invitation event, schedule modification, and availability change performed through the IAM_Module.
8. WHEN an administrator selects a specific audit entry, THE Admin_Portal SHALL display a detail view showing the full structured change data and a navigation link to the affected resource; IF the affected resource has been deleted, THEN THE Admin_Portal SHALL display the link as inactive with a label indicating the resource no longer exists.
9. IF the applied filters return zero matching audit entries, THEN THE Admin_Portal SHALL display an empty state message indicating no entries match the current filter criteria.

### Requirement 8: Organization-Scoped Access Control

**User Story:** As a platform operator, I want all IAM_Module operations to respect organization boundaries, so that multi-tenant data isolation is guaranteed.

#### Acceptance Criteria

1. THE API_Service SHALL include the organizationId from the authenticated user's JWT token in all IAM_Module read and write operations for Company_Admin and Provider roles.
2. WHILE a Company_Admin is authenticated, THE API_Service SHALL filter all IAM_Module query results and restrict all IAM_Module create, update, and delete operations to only affect records matching the Company_Admin's organizationId.
3. WHILE a Super_Admin is authenticated, THE API_Service SHALL allow cross-organization access to all IAM_Module resources without organizationId filtering.
4. WHEN the API_Service receives a request for an IAM_Module operation, THE API_Service SHALL verify the user's role has the required permission before evaluating organization-scope rules.
5. IF a request targets a resource belonging to a different organization than the authenticated user, THEN THE API_Service SHALL return a 403 Forbidden response with an error message indicating an organization boundary violation for non-Super_Admin roles.
6. THE API_Service SHALL log all access-denied events as audit entries with the denied actor, requested resource, attempted action, and denial reason within 1 second of the denial occurring.
7. IF the authenticated user's JWT token does not contain a valid organizationId claim, THEN THE API_Service SHALL reject the request with a 401 Unauthorized response and SHALL NOT execute the requested operation.
8. IF the permission check fails for the authenticated user's role, THEN THE API_Service SHALL return a 403 Forbidden response with an error message indicating insufficient permissions and SHALL NOT evaluate organization-scope rules.
