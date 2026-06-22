# Fix notes — 2026-04-16

## What was fixed
- Patient RPM reading submission no longer fails when the subject has no pre-existing RPM program record.
- The API now auto-provisions a default active RPM program on the first successful reading submission.

## File changed
- `services/api/src/modules/patient-rpm/rpm.routes.ts`

## Why
In the latest runtime logs, `POST /api/patient/rpm/readings` returned `400` repeatedly while the rest of the patient profile flow was working. The most likely cause was the route requiring an existing RPM program row before allowing the first reading to be saved.

## Result
The first reading can now create the RPM program baseline automatically, then store the submitted reading in the same request.
