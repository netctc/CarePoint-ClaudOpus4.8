# Patient Change Request – Phase 3

## Scope
This phase makes the Patient mobile Home dashboard subject-aware for the active family profile context.

## Implemented

### Mobile
- `AppSession.dashboard()` now sends `subjectProfileId` when a family profile is active.
- Home dashboard now reloads automatically when the active subject changes.
- Home dashboard now consumes bundled subject-aware sections from `/api/dashboard/patient` for:
  - upcoming appointment reminder
  - health reminders summary
  - latest vitals summary and recent readings
  - latest questionnaire result
- Home dashboard still loads diagnostic results from the dedicated patient labs endpoint, which is already subject-aware.

### API
- `/api/dashboard/patient` now resolves the active subject using `subjectProfileId`.
- Next appointment is filtered to the active subject context.
- Dashboard response now includes:
  - `activeSubject`
  - `home.upcomingAppointments`
  - `home.reminders`
  - `home.vitals`
  - `home.questionnaire`
- Questionnaire summary includes a legacy fallback for pre-versioned questionnaire data still stored in the encrypted medical profile.

## Files changed
- `apps/mobile/lib/core/state/app_session.dart`
- `apps/mobile/lib/features/home/presentation/screens/home_dashboard_page.dart`
- `services/api/src/modules/dashboard/dashboard.routes.ts`

## Remaining recommended next step
- Persist appointment access metadata and dashboard home widgets in first-class database models instead of relying on fallback workspace/audit storage where model tables are not present.
