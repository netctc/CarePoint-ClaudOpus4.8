# CarePoint V16 - Admin Login, Shell and Dashboard

## Strategy

V16 starts the Admin web redesign from the safe restored branch. The functional base is preserved from the previous V15 package, which itself follows the V6-first restoration strategy.

The goal of this delivery is visual modernization without replacing working Admin logic.

## Scope delivered

### Admin login
- Modernized the existing Admin privileged sign-in visual style through the current login structure.
- Preserved the full authentication flow:
  - managed-device confirmation
  - privileged-access acknowledgement
  - challenge creation
  - challenge verification
  - challenge resend
  - enterprise SSO start
  - review/demo fallback behavior

### Admin shell
- Modernized the Admin portal shell with V16 layout classes.
- Preserved session loading through `getBrowserSession()`.
- Preserved live `adminApi.me()` profile lookup.
- Preserved backend role mapping.
- Preserved RBAC-driven route visibility through `getVisibleRoutes(role)`.
- Preserved all existing Admin routes and navigation destinations.

### Admin topbar
- Added V16 visual treatment to search, profile, notifications and topbar surfaces.
- Added an Emergency Triage visual action without changing existing routing or API behavior.
- Preserved language switching and profile context.

### Admin sidebar
- Added V16 visual treatment.
- Added a safe shortcut to provider review.
- Kept all RBAC-visible menu groups and existing route labels.

### Admin dashboard
- Modernized the existing dashboard surfaces using CSS and shell classes.
- Preserved the dashboard functional loaders:
  - `loadIntegratedDashboard()`
  - `loadRefillRequests()`
  - `loadIntegratedPaymentsWorkspace()`
- Preserved provider directory summaries, queue pressure, alerts, payments, governed refill summary and audit activity.

## Functional preservation rules followed

- No dashboard loaders were replaced by static data.
- No Admin route was removed.
- No Admin route was converted into a redirect.
- No RBAC behavior was removed.
- No auth/challenge/SSO logic was rewritten.
- New styling was added as an overlay on top of existing functional pages.

## Validation

Build command executed:

```bash
cd apps/admin
npm install --ignore-scripts
npm run build
```

Result: build successful.

Validation artifacts:

- `validation/v16/admin_route_files_v16.txt`
- `validation/v16/admin_v16_build_result.txt`
