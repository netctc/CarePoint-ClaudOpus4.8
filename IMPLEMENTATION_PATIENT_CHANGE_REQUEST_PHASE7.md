# Patient enhancement phase 7

This patch closes the last two gaps from the uploaded patient enhancement request:

1. **Health Questionnaire fully decoupled from Profile persistence**
   - Profile setup no longer loads or saves questionnaire content.
   - Medical profile update APIs now preserve the existing questionnaire when the profile page updates reports or sharing settings.
   - Questionnaire submissions continue through the dedicated versioned questionnaire endpoints only.
   - Legacy embedded questionnaire data is still readable as a migration fallback when no questionnaire versions exist yet.

2. **Immediate doctor-access consent prompt after booking**
   - Booking confirmation now loads the appointment access-consent state.
   - If access is not already granted, the patient is prompted immediately on the confirmation screen.
   - The same screen also provides grant, revoke, and refresh actions.
   - Appointment detail remains the long-term place to review and revoke the consent later.

## Main files changed

- `apps/mobile/lib/core/state/app_session.dart`
- `apps/mobile/lib/features/profile/presentation/screens/profile_setup_page.dart`
- `apps/mobile/lib/features/booking/presentation/screens/booking_confirmation_page.dart`
- `services/api/src/modules/patient-profile/profile.routes.ts`
- `services/api/src/modules/patient-family/family.routes.ts`
- `services/api/src/modules/patient-questionnaires/questionnaires.routes.ts`

## Notes

- This patch intentionally keeps legacy questionnaire reads for migration compatibility.
- New questionnaire submissions are no longer mirrored back into the medical profile blob.
