# Patient Mobile App – Phase 12

## Fix applied
Resolved Flutter web runtime error:

- `setState() callback argument returned a Future`

## Root cause
Several screens used the pattern:

```dart
setState(() => _future = refreshed);
```

Because assignment expressions return the assigned value, this caused the `setState` callback to return a `Future`, which Flutter rejects at runtime.

## Fix
Replaced those with block-bodied callbacks:

```dart
setState(() {
  _future = refreshed;
});
```

## Screens patched
- Appointments
- Booking select slot
- Care plan
- Encounter summary
- Family profiles
- Home dashboard
- Lab results
- Messages
- Notifications
- Prescriptions
- Health questionnaire hub
- Health questionnaire version detail
- Provider search
- Records
- Reminders
- RPM/vitals
- Support
- Telehealth
- Wallet

This prevents the same runtime crash from recurring on other pages that refresh data with a `FutureBuilder`.
