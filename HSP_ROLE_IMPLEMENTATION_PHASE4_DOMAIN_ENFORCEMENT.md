# HSP Role Implementation — Phase 4 Domain Enforcement

This phase extends the HSP access model from facility-only scope checks into domain-aware enforcement for additional provider workflows.

## Implemented in this phase

### Service API
- Added domain-aware helpers in `services/api/src/lib/hsp-access.ts`
  - `filterItemsByHspDomain()`
  - `requireDomainScopedHspLocationAccess()`
  - `getMatchingHspFacility()`
  - `isExternalHspLocation()`
  - `canAccessDomainForLocation()`
- Extended HSP access summaries with:
  - `grantedDomains`
  - `enforcementStatusByDomain`

### Provider domains now enforced
- Calendar
- Labs
- Analytics
- Prescriptions
- Orders
- RPM

### Provider prescriptions
- Prescription lists and detail now resolve/attach facility location and enforce `PRESCRIPTIONS` access.
- Refill queues now inherit location from the related prescription and enforce `PRESCRIPTIONS` access.
- Refill history, assignment, escalation, and review now validate HSP domain access before mutating queue state.
- Privileged org roles use org-wide HSP access summaries instead of failing provider-context resolution.

### Provider orders
- Order composer context validates the active location against HSP `ORDERS` scope.
- Orders now accept/store `location` and infer it from the appointment or primary facility when missing.
- Order lists, detail, create, and submit flows now enforce `ORDERS` access.

### Provider RPM
- RPM enrollments are normalized to a facility location using `location`, `facilityName`, or the primary facility fallback.
- RPM summary, patient list, patient detail, outreach, and escalation now enforce `RPM` access.

### Provider web / provider mobile
- HSP access pages now show domain-level enforcement status in addition to granted domains.
- Messaging updated to reflect enforcement on analytics, prescriptions, orders, and RPM in addition to calendar/labs.

## Notes
- This phase still relies on stored or inferred facility names for some legacy records that do not persist a strong facility foreign key.
- The next deeper phase should add first-class facility identifiers to prescriptions, orders, RPM enrollments, and refill requests so enforcement is fully deterministic rather than partly inferred.
