# HSP Role Verification and Modification Plan

## Verified status against the requested HSP definition

### What already matches
- Individual user authentication and role-based sessions exist.
- Multiple users can already be linked to the same `organizationId`, which partially supports institutional use.
- Many provider/admin routes already enforce organization scope checks.
- Chart-access exceptions already exist as a partial foundation for explicit access grants.

### What does not fully match yet
1. The codebase did not explicitly model the three HSP account types: `INDIVIDUAL`, `INSTITUTIONAL`, `ORGANIZATION_BASED`.
2. Provider and admin experiences did not consistently expose the HSP account model or access scope.
3. Multi-center / multi-hospital organization access was not represented as an explicit HSP access summary.
4. Cross-center access-by-consent was not surfaced consistently across API payloads and UI.
5. Some admin mappings incorrectly inferred provider type from service mode instead of a true HSP classification.

## Exact modifications required across the applications

### Service API
- Add explicit HSP account model and access scope definitions.
- Add a normalized HSP access summary to authenticated provider responses.
- Extend provider onboarding payloads to capture HSP account model, primary facility, cross-facility consent scope, and access notes.
- Expose HSP access endpoints for provider/admin views.
- Include HSP metadata in provider directory/detail responses.

### Admin web
- Stop inferring provider type from `serviceMode`.
- Read provider HSP model and access scope from the API.
- Show organization name and primary facility correctly in provider directory/detail flows.

### Provider web
- Extend onboarding to collect the HSP account model and requested cross-facility access.
- Show the provider's HSP access summary from the API.

### Provider mobile
- Extend onboarding with HSP model and consent scope fields.
- Surface HSP access summary in provider settings.

### Patient mobile
- Show whether the selected provider is an individual, institutional, or organization-based HSP during discovery/profile flows.

## Implementation started in this revision
- Added shared HSP access derivation logic in the service API.
- Added `hspAccess` to `/api/auth/me` for provider-side roles.
- Added `/api/access/hsp/*` endpoints.
- Extended provider onboarding API payloads and provider web/mobile onboarding screens.
- Updated admin provider mapping to use HSP data.
- Updated patient provider cards/profile to surface the HSP type.
