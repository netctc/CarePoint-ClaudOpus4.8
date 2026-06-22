# Admin Accounts CRUD — Phase 2 Hardening

## Scope
This phase extends the initial patient/provider account CRUD implementation with governance and safety controls.

## Implemented changes

### API
- Added `GET /api/admin/users/organizations` for organization selection.
- Added duplicate email validation before create/update.
- Added password reset support when a non-empty `password` is submitted during account modification.
- Added dependency-readiness checks before delete operations.
- Delete now removes refresh tokens for accounts that are safe to delete.
- Delete is blocked with a structured dependency summary when protected downstream records exist.
- Patient delete readiness checks include appointments, medical records, message threads, payments, family profiles, notifications, support tickets, reminders, care plans, RPM programs, consent records, sent messages, and audit actor references.
- Provider delete readiness checks include appointments, medical records, message threads, payments, schedules, clinical orders, prescriptions, labs, RPM enrollments, alerts, facility settings, sent messages, and audit actor references.

### Admin UI
- Account creation forms now include organization selection for Super Admin usage.
- Existing account rows keep their organization scope hidden during update.
- Modify forms now include optional temporary password reset fields.
- Account lists now display dependency summaries for delete readiness.
- Delete buttons are disabled when protected dependencies exist.

## Environment changes
No new environment variables are required.

## Notes
- No `.env` file is included in this deliverable.
- Deletion remains intentionally conservative for healthcare compliance and audit integrity.
