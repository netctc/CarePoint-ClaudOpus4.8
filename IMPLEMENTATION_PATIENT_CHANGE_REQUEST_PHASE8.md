# Patient Change Request – Phase 8

## Included fixes
- Patched family profile creation flow so creating a dependent no longer fails when relationship evidence is still pending.
- Mobile family add flow now requests only `BOOKING` permission by default.
- API now safely downgrades protected `MEDICAL_RECORDS` permission into `pendingPermissions` until legal relationship evidence is verified, instead of returning HTTP 400.

## Verified route issue from user log
- Route: `POST /api/patient/family/profiles`
- Cause: the mobile client posted `permissions: ['BOOKING', 'MEDICAL_RECORDS']` for relationships like `Child`.
- Backend policy requires verified legal relationship evidence before record access can be granted.
- Result before fix: request failed with 400.
- Result after fix: request succeeds, record access stays pending until verification.

## Phase 8 functional additions
- Admin audit UI now supports subject-scope filtering with direct links for:
  - all subjects
  - self only
  - family / dependent only
- Admin audit server loader now passes `subjectScope` through to the API.
- Admin finance reconciliation workspace now surfaces subject context when available in payment metadata.

## Files updated
- `services/api/src/modules/patient-family/family.routes.ts`
- `apps/mobile/lib/features/family/presentation/screens/family_profiles_dependents_page.dart`
- `apps/admin/src/lib/api/admin-server.ts`
- `apps/admin/src/app/portal/audit/logs/page.tsx`

## Validation note
- This is a targeted code pass.
- Full installed workspace build/runtime validation was not performed in this environment.
