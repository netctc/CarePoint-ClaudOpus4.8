# CarePoint Patient Mobile — Implementation Status

Version: patient-v0.7-integration-slot-1-patient-expansion

## Included in this slot
- wired `/family/profiles` to live patient family endpoints
- wired `/notifications/center` to live patient notifications endpoints
- wired `/support` to live patient support endpoints
- wired `/reminders/medication` to live patient reminders endpoints
- wired `/care-plan` to live patient care-plan endpoints
- wired `/care-plan/task` to live patient care-plan task actions
- wired `/rpm/setup` to live patient RPM summary/program endpoints
- wired `/rpm/trends` to live patient RPM readings endpoints

## What changed
- added patient workspace API methods in `AppSession`
- replaced hybrid family data with live dependent profile summary, list, create, and invite actions
- replaced derived notifications feed with live patient notifications summary, feed, read, and preference actions
- replaced local support intake with live ticket summary, list, create, and comment actions
- replaced reminder derivation with live patient reminder plans and toggle/create actions
- replaced care-plan derivation with live care-plan summary, tasks, task detail, complete, and snooze actions
- replaced RPM derivation with live RPM summary, program, readings, and manual reading submission

## Runtime notes
- these pages now expect the Slot G patient backend expansion API to be present
- no runtime `.env` is packaged
- Flutter and Dart tooling were not available in-container, so this slot was source-updated and packaging-checked but not device-run here

## Next step
- patient smoke pass focused on family, notifications, support, reminders, care plan, and RPM
