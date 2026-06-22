# Patient Change Request – Implementation Phase 2

This delivery includes the requested hotfixes from the reported mobile compile error and continues the next implementation slice for family-profile subject isolation.

## Hotfixes included

### 1) Dart localization string fix
Updated:
- `apps/mobile/lib/core/localization/app_localizations.dart`

Fix:
- corrected the `family.heroBody` string quoting issue so the apostrophe in `person's` no longer breaks Dart compilation.

### 2) Booking hold state fix
Updated:
- `apps/mobile/lib/features/booking/presentation/screens/review_payment_page.dart`

Fix:
- added the missing `_extendingHold` state field used by the extend-hold button and loading state.

### 3) Slot hold API parameter fix
Updated:
- `apps/mobile/lib/features/booking/presentation/screens/select_slot_page.dart`

Fix:
- changed the `extendSlotHold(...)` call from `durationMinutes` to `extendMinutes` to match the mobile session API method.

## Continued implementation in this phase

### Family-profile subject propagation in mobile app session
Updated:
- `apps/mobile/lib/core/state/app_session.dart`

Added:
- subject-aware query/body helpers using the active selected family profile
- subject propagation for:
  - appointments
  - records
  - labs
  - prescriptions
  - refill requests
  - reminders
  - care plan
  - RPM
  - booking documents
  - booking hold / booking confirmation payloads

### Backend patient subject resolution
Updated:
- `services/api/src/lib/patient-context.ts`

Added:
- request subject extraction helper
- patient context resolution for either:
  - self patient profile
  - selected dependent/family profile
- normalized context fields:
  - `subjectProfileId`
  - `subjectName`
  - `subjectRelationship`
  - `isFamilySubject`

### Family-aware patient workspace modules
Updated:
- `services/api/src/modules/patient-reminders/reminders.routes.ts`
- `services/api/src/modules/patient-care-plan/care-plan.routes.ts`
- `services/api/src/modules/patient-rpm/rpm.routes.ts`

Added:
- workspace scope now follows the selected family profile instead of always using the primary patient profile
- this keeps reminders, care tasks, and RPM readings isolated per dependent profile

### Booking document family-scope support
Updated:
- `services/api/src/lib/booking-document-store.ts`
- `services/api/src/modules/appointments/appointments.routes.ts`

Added:
- booking documents can now carry `subjectProfileId` metadata
- document listing is filtered by selected family profile
- appointment notes are tagged with subject metadata for dependent bookings
- patient appointment list filters self vs dependent bookings using the stored subject marker

### Family-profile records, reports, labs, and medications
Updated:
- `services/api/src/modules/records/records.routes.ts`

Added:
- family-profile record hub view derived from encrypted dependent medical profile data
- family-profile uploaded reports exposed as isolated record items
- family-profile lab list/detail derived from uploaded report categories that match lab/pathology
- family-profile medication list derived from questionnaire current medications
- dependent refill requests intentionally blocked for now until provider-linked prescription release is implemented

## Validation completed

### TypeScript syntax/transpile sanity check
Passed for:
- `services/api/src/lib/patient-context.ts`
- `services/api/src/lib/booking-document-store.ts`
- `services/api/src/modules/appointments/appointments.routes.ts`
- `services/api/src/modules/records/records.routes.ts`
- `services/api/src/modules/patient-reminders/reminders.routes.ts`
- `services/api/src/modules/patient-care-plan/care-plan.routes.ts`
- `services/api/src/modules/patient-rpm/rpm.routes.ts`

## Important limitations still remaining

- full Flutter runtime validation was not executed inside this environment
- appointment subject tagging currently uses appointment notes metadata markers rather than a dedicated appointment metadata column
- dependent prescriptions/labs are currently patient-reported / uploaded-data based unless provider-originated clinical records are created for that dependent context
- dependent refill requests remain disabled until the provider and release layers are extended for dependent prescription ownership

## Recommended next phase

1. Add explicit appointment / booking metadata fields instead of note markers
2. Extend provider-side release flows so prescriptions and labs can be authored directly against dependent/family subject context
3. Add file-picker binary upload for patient report attachments instead of metadata-only capture
4. Add QA smoke tests for:
   - switch family profile -> booking -> appointment list isolation
   - switch family profile -> records / reports / meds isolation
   - switch family profile -> reminders / care plan / RPM isolation
