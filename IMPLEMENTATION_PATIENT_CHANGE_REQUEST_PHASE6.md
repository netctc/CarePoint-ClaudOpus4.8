# Patient Mobile Application – Phase 6

## Scope
This phase fixes stale active-profile data in Patient mobile pages. Before this patch, only the Home dashboard refreshed automatically when the user switched between self and family profiles. Other Patient pages continued showing the previous subject's data until the screen was closed and opened again.

## Implemented
- Added active-subject listeners and automatic data reloads to:
  - Upcoming appointments
  - Appointment detail
  - Health questionnaire hub
  - Questionnaire version detail
  - Medication reminders
  - Latest vitals tests
  - Lab results list
  - Lab result detail
- Manual refresh actions now also resync the current subject key before reloading.

## Result
When the active family profile changes, these pages now refresh in place and request the correct subject-scoped API data. This removes a major source of stale or misleading patient information.

## Verification notes
- The earlier API error in `/api/dashboard/patient` was already traced to an undefined `serializeAppointment` helper in the dashboard route.
- This phase focuses on Patient mobile UI state synchronization and does not add new backend routes.
- Full Flutter build verification was not run in the container because the workspace does not include the installed local toolchain/dependencies.
