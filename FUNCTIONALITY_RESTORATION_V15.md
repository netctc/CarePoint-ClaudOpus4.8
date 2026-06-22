# CarePoint V15 - Provider Patients, Schedules, and Logout

## Base strategy
V15 continues from V14 and keeps the safe restoration strategy:
- V6/V12 functional base remains the source of truth.
- V13/V14 modern Provider design layer remains in place.
- V15 applies design and functional polish only to targeted provider areas.

## Scope completed

### 1. Provider patients workspace
Added `/portal/patients` as a provider-facing patient workspace that keeps existing functional routes active:
- Live source: `providerApi.appointments()`
- Live RPM source: `providerApi.providerRpmPatients()`
- Fallback source: `getRpmProgramData()`
- Actions preserve navigation to:
  - `/portal/chart/[patientId]`
  - `/portal/rpm/[patientId]`
  - `/portal/orders/new?patientId=...`
  - `/portal/prescriptions/new?patientId=...`
  - `/portal/labs/inbox`
  - `/portal/messages`
  - `/portal/queue`

### 2. Provider schedule/calendar polish
Updated `/portal/calendar` with V15 modern surface classes while preserving existing functionality:
- `providerApi.providerCalendarOverview()`
- `providerApi.bookingControlHolds(20)`
- `providerApi.bookingPolicyPreview(...)`
- `providerApi.createProviderPublishedSlot(...)`
- `providerApi.updateProviderPublishedSlot(...)`
- `providerApi.cancelProviderPublishedSlot(...)`
- fallback schedule via `getCalendarData()`
- template route preserved via `/portal/calendar/templates`

### 3. Patient chart polish
Updated `/portal/chart/[patientId]` with V15 modern surface classes while preserving existing functionality:
- `providerApi.records(patientId, subjectProfileId)`
- `providerApi.appointments()`
- `providerApi.me()`
- `providerApi.chartAccessContext(...)`
- `providerApi.providerPatientReports(...)`
- `providerApi.createRecord(...)`
- subject profile/dependent chart context preserved

### 4. Provider logout dropdown
Implemented top-right profile dropdown in the Provider topbar:
- Click authenticated user to open account menu.
- Sign out calls `providerApi.logout()` when available.
- Local provider cookies are cleared even if API logout fails.
- Redirects to `/sign-in`.
- Escape and outside-click close behavior implemented.
- English and Arabic labels added.

### 5. Navigation update
Provider sidebar now includes the Patients workspace at `/portal/patients`.

## Validation
- `npm run build` executed in `apps/provider`.
- Build result: SUCCESS.

## Files added/modified
- `apps/provider/app/portal/patients/page.tsx`
- `apps/provider/app/portal/calendar/page.tsx`
- `apps/provider/app/portal/chart/[patientId]/page.tsx`
- `apps/provider/components/layout/top-header.tsx`
- `apps/provider/components/layout/sidebar-nav.tsx`
- `apps/provider/components/shared/provider-icons.tsx`
- `apps/provider/lib/i18n/provider-dictionary.ts`
- `apps/provider/services/api-client.ts`
- `apps/provider/app/globals.css`
- `validation/v15/provider_route_files_v15.txt`
- `validation/v15/provider_v15_build_result.txt`

## Notes
The build generated the new `/portal/patients` route and all existing Provider portal routes remained present.
