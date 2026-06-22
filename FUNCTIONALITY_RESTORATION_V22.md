# FUNCTIONALITY RESTORATION V22 - Patient Mobile Functional Modifications

## Scope
This version continues from V21.1 and focuses on the patient mobile application (`apps/mobile`). It does not change the Admin or Provider web redesign work.

## Implemented changes

### 1. OTP verification
- Increased OTP digit visual size and adjusted input padding.
- Added focus nodes for each OTP digit field.
- After entering a digit, focus moves automatically to the next OTP field.
- After the final digit is entered, verification is triggered.

### 2. Profile setup
- Replaced the visible `National ID / Iqama` label with `National ID`.
- Removed remaining patient-mobile references to `Iqama` in identity upload labels.
- Country / Region now defaults to `Lebanon` when no saved profile value exists.
- Country / Region now uses a continent-organized selected list with 197 country options.
- Nationality is now a selected list and defaults to `Lebanese`.

### 3. Health reminders
- Reminder scheduling now supports:
  - exact reminder hour (`Daily at HH:MM AM/PM`)
  - repeat intervals (`Every 2/4/6/8/12 hours`)
- Newly created or edited reminders are inserted into the visible reminder list immediately after the API returns, without requiring a page refresh.
- The app still refreshes from the API in the background to reconcile with the server.

### 4. Latest diagnostic results
- The home dashboard now combines diagnostic data from:
  - released provider/lab results: `/api/records/patient-labs`
  - patient-uploaded diagnostic reports from the medical profile
- Empty state copy now explicitly states the data source feeding the section.
- Patient-uploaded reports open Profile Setup; released lab results open the lab detail page.

### 5. Bottom navigation bar
- The shared `PatientScaffold` now shows the bottom navigation bar across authenticated patient pages.
- The navigation bar is excluded only from public/auth/setup pages.
- Pages with a bottom action now render the action and the global navigation together.

### 6. Back button
- The shared back button now uses `context.canPop()` before popping.
- If no previous route exists, it safely falls back to `/home` for authenticated users or `/entry` for public users.

### 7. New appointment filters and slot selection
- City filter is now displayed only when Service Mode is not `Online`.
- Applying filters with `Online` mode automatically resets city to `Any`.
- Online provider search ignores city matching.
- Select Slot now omits location filtering for online appointments and requests 21 days of availability.
- Select Slot now uses the selected slot's actual service/location when creating the hold and booking policy preview.
- Empty state copy was changed from “No live slots are available” to a clearer published-future-slot message.

## Validation
- Static checks were generated in `validation/v22/patient_mobile_v22_static_checks.txt`.
- Flutter build/analyze could not be executed in this environment because the Flutter/Dart SDK is not installed.

## Recommended local validation
From `apps/mobile`, run:

```bash
flutter pub get
flutter analyze
flutter test
flutter build apk --debug
```
