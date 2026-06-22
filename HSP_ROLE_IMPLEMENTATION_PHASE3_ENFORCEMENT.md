# HSP Role Implementation – Phase 3 (Backend Enforcement)

Implemented in this phase:

1. **Provider HSP access resolution now uses stored onboarding fields**
   - `getProviderContext()` now resolves HSP access from the provider onboarding state rather than relying only on organization defaults.

2. **Facility-scoped enforcement added to provider calendar routes**
   - Overview, availability, published slots, schedule templates, template publish, and manual slot creation/update now respect the active HSP facility scope.
   - Locations outside the allowed facility set are filtered or rejected.

3. **Facility-scoped enforcement added to provider lab routes**
   - Lab inbox, result detail, release readiness, order creation, verification, second review, and release now require the requested lab location to fall inside the active HSP facility scope.

4. **Provider chart access tightened**
   - Chart access decisions now count only appointments whose location falls inside the provider’s active HSP facility scope.
   - Existing authored records still count toward provider ownership.

5. **Provider analytics overview aligned to facility scope**
   - Visit, completion, and telehealth metrics are now calculated only from appointments inside the active HSP facility scope.

6. **HSP access UI updates**
   - Provider web and provider mobile HSP access pages now surface granted data domains and note that facility-scoped API enforcement is active.

Notes:
- This phase enforces facility scope on the most location-aware provider routes first.
- Order, RPM, and some prescription governance routes remain candidates for a later domain-aware enforcement pass where facility location is not directly stored on every resource.
