# CarePoint Provider Mobile

Standalone Flutter mobile application for healthcare providers.

## Run

```bash
cd apps/provider_mobile
flutter pub get
flutter run --dart-define=API_BASE_URL=http://localhost:4000
```

## Current scope in this implementation

- Dedicated provider mobile app separated from the patient mobile app
- Provider privileged sign-in flow using `/api/auth/challenge/start` and `/api/auth/challenge/verify`
- Provider shell navigation for dashboard, queue, calendar, messages, alerts, telehealth, records, orders, prescriptions, labs, RPM, analytics, team, and settings
- Shared API client with cached GET fallback for mobile/offline resilience
- Dashboard and core operational pages wired to the existing Service API
- Clinical workflow screens for:
  - patient chart summary
  - encounter note validation/signing
  - order draft/submit flow
  - prescription draft/compliance preview/sign flow
  - lab result detail
  - RPM patient detail
- Operational workflow screens for:
  - record detail drill-down with structured metadata
  - refill request review, assignment, escalation, and history
  - chart-access exception management
- Offline/mobile-readiness features for:
  - offline action queue and retry screen
  - local notification preferences
  - attachment staging in encounter, order, and prescription composers
- Advanced operational workflows for:
  - telehealth session detail with start/join/end controls
  - lab verification, second review, and release workflow
  - facility settings detail editor
- HSP consent enforcement for:
  - facility-scoped calendar and lab access
  - facility-aware provider chart access
  - provider analytics overview filtered to active HSP facility scope

## Next recommended iterations

- Native file/camera picking and true binary attachment upload
- Push notifications and device token registration
- Offline queue expansion for additional mutations
- Native deep-link handling for telehealth joins
- Full localization, accessibility, and device testing

## Local web sign-in CORS note

When running the provider mobile app on Flutter Web, the browser origin is often `http://localhost:8081`.
The service API must allow that origin for `/api/auth/challenge/start` and other provider routes.
Use the root `.env` values below before starting the API:

```env
FRONTEND_PROVIDER_MOBILE_URL=http://localhost:8081
FRONTEND_ALLOWED_ORIGINS=http://localhost:8081
ALLOW_LOCALHOST_CORS_WILDCARD=true
```

## Demo provider credentials

Use the seeded provider account for local verification:

- Email: `provider@carecenter.local`
- Password: `ChangeMe123!`

Run the API seed if these accounts do not exist yet.


11. Provider onboarding and schedule operations for:
   - provider onboarding mobile workflow with draft/save and submit
   - schedule manager for calendar templates and published slots
   - mobile template creation/editing/publishing
   - mobile manual slot publishing and cancellation
