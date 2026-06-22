# Patient Change Request – Implementation Phase 1

This package contains a first code implementation pass for the patient mobile change request.

## Implemented in this phase

### 1) Simplified entrance flow
- Added a new unified mobile entry screen:
  - region selection
  - language selection
  - identifier input
  - telehealth/data-sharing/notification consent capture
- Kept OTP verification as the separate next step.
- Updated mobile routing so unauthenticated users enter through the unified entry page.
- Draft consent is captured before OTP and persisted after successful verification.

### 2) Patient profile enhancements
- Added encrypted backend storage helpers for medical questionnaire/report payloads.
- Added patient API endpoints:
  - `GET /api/patient/profile/medical`
  - `PUT /api/patient/profile/medical`
- Extended the mobile profile screen to include:
  - health questionnaire fields
  - diagnostic history / report list
  - report metadata attachment flow
  - share-with-scheduled-doctors toggle

### 3) Family member management foundation
- Added family-member medical API endpoints:
  - `GET /api/patient/family/profiles/:profileId/medical`
  - `PUT /api/patient/family/profiles/:profileId/medical`
- Extended family profile creation to include extra identity fields.
- Implemented patient-context switching in the mobile app for:
  - self profile
  - family/dependent profile
- Extended the family screen to:
  - add multiple family members
  - switch the active medical profile

### 4) Data security and consent controls
- Added application-level encryption for stored medical questionnaire/report payloads.
- Added provider-side gated access endpoint for patient-uploaded reports:
  - `GET /api/records/provider/patient-reports?patientId=...`
- Access is restricted to provider users with scheduled appointments and accepted patient data-sharing consent.

## Partially implemented / next phase
- Booking under a selected dependent profile is not yet completed.
- Records, medications, labs, and prescriptions are not yet fully re-scoped across every mobile route to the active family profile.
- File picker / binary upload is not yet integrated; this phase stores structured attachment metadata for reports.
- Provider UI consumption of the new report-access endpoint is not yet wired into the provider portal.
- Admin-side consent oversight and audit dashboards are not yet updated for the new medical-profile/report model.

## Main files changed
- `apps/mobile/lib/app/router/app_router.dart`
- `apps/mobile/lib/core/state/app_session.dart`
- `apps/mobile/lib/core/localization/app_localizations.dart`
- `apps/mobile/lib/features/onboarding/presentation/screens/unified_entry_page.dart`
- `apps/mobile/lib/features/profile/presentation/screens/profile_setup_page.dart`
- `apps/mobile/lib/features/family/presentation/screens/family_profiles_dependents_page.dart`
- `apps/mobile/lib/features/home/presentation/screens/home_dashboard_page.dart`
- `services/api/src/lib/secure-medical-data.ts`
- `services/api/src/modules/patient-profile/profile.routes.ts`
- `services/api/src/modules/patient-family/family.routes.ts`
- `services/api/src/modules/records/records.routes.ts`

## Notes
- This is a foundation implementation pass intended to move the repository from specification into working code structure.
- Because the workspace here does not have the full dependency/runtime toolchain installed, this package was validated by targeted code inspection rather than a complete mobile/API build.
