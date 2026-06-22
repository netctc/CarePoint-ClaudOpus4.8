# HSP Role Implementation Phase 5 – Remaining Domain Enforcement

This phase completes the next enforcement slice requested for provider-side facility-domain governance.

## Exact modifications implemented

### 1. Service API shared HSP enforcement helpers
File: `services/api/src/lib/hsp-access.ts`
- Added `normalizeRequestedHspLocation()`
- Added `matchesRequestedHspLocation()`
- Added `filterItemsByHspDomainAndLocation()`
- Added `summarizeHspItemsByFacility()`

Purpose:
- allow every remaining provider route to accept an optional facility filter
- validate that the requested facility is inside the active HSP scope
- apply domain-aware filtering consistently
- expose facility breakdowns for UI reporting

### 2. Prescription governance enforcement
File: `services/api/src/modules/provider-prescriptions/prescriptions.routes.ts`
- Added location inference helper for prescriptions when explicit location is absent
- `GET /api/provider/prescriptions/summary`
  - now supports `location`
  - returns `facilityBreakdown`
- `GET /api/provider/prescriptions/items`
  - now supports `location`
- `GET /api/provider/prescriptions/refill-requests`
  - now supports `location`
- `GET /api/provider/prescriptions/pharmacy-queue`
  - now supports `location`
- `GET /api/provider/prescriptions/audit-packet-summary`
  - now supports `location`
  - accessible summary is based on domain-scoped facility-filtered refill requests
- `POST /api/provider/prescriptions/items`
  - now infers location from appointment or latest provider appointment before falling back to primary facility
- Existing mutation routes continue to enforce HSP domain access before action

### 3. RPM cross-facility aggregation
File: `services/api/src/modules/provider-rpm/rpm.routes.ts`
- RPM items now derive fallback location from recent provider appointments when enrollment data lacks facility
- `GET /api/provider/rpm/summary`
  - now supports `location`
  - returns `facilityBreakdown`
- `GET /api/provider/rpm/patients`
  - now supports `location`
  - returns `facilityBreakdown`
- Detail, outreach, and escalate flows continue to enforce HSP RPM access on the resolved patient facility

### 4. Order workflows without explicit facility fields
File: `services/api/src/modules/provider-orders/orders.routes.ts`
- Added order-location inference helper
- Order creation now resolves facility in this order:
  1. explicit request location
  2. appointment location
  3. encounter-linked medical-record appointment location
  4. latest provider appointment for the patient
  5. provider primary facility
- `GET /api/provider/orders/summary`
  - now supports `location`
  - returns `facilityBreakdown`
- `GET /api/provider/orders/items`
  - now supports `location`
- Order detail and submit flows continue to enforce HSP order scope

### 5. Analytics and reporting filters
File: `services/api/src/modules/provider-analytics/analytics.routes.ts`
- `GET /api/provider/analytics/overview`
  - now supports `location`
  - validates requested analytics facility against HSP scope
  - filters appointment analytics by accessible facility/domain
  - links revenue to scoped appointments only
  - narrows message-thread counts to patients in the scoped facility cohort
  - returns `facilityBreakdown`
- This phase focuses on operational analytics used by provider web/mobile. Audit/compliance routes remain organization-scoped unless future audit payloads carry reliable facility metadata.

### 6. Provider web integration
Files:
- `apps/provider/services/api-client.ts`
- `apps/provider/app/portal/analytics/page.tsx`

Changes:
- analytics client now accepts optional `location`
- RPM and prescription governance client calls now accept optional `location` where applicable
- provider analytics page now includes facility selector
- provider analytics page now displays facility breakdown from the API

### 7. Provider mobile integration
Files:
- `apps/provider_mobile/lib/features/auth/data/provider_api_service.dart`
- `apps/provider_mobile/lib/features/analytics/presentation/screens/provider_analytics_page.dart`

Changes:
- analytics API method now accepts optional `location`
- RPM API methods now accept optional `location`
- order/prescription/refill API methods were extended for filtered calls where needed
- provider mobile analytics page now includes facility filter selection
- provider mobile analytics page now displays facility breakdown

## Remaining gap after this phase
Still not fully enforced everywhere:
- compliance/audit exports remain organization-scoped unless audit logs get explicit facility metadata
- any legacy provider route that never carries location or patient context must still be normalized later before domain enforcement can be mathematically exact
