# CarePoint V22.1 - Patient Mobile Runtime Stabilization

## Why this patch exists
The runtime logs after V22 showed three important issues:

1. Patient availability requests returned an empty response body size for live slot queries even after provider slots were published.
2. Flutter web received repeated 304 responses for patient dashboard/lab/profile endpoints, which can decode as empty maps in the mobile HTTP client.
3. Provider web showed Next.js 16 warnings for a deprecated `eslint` key in `next.config.mjs`, plus nested sign-in redirects when a 401 happened while already on sign-in.

## Changes included

### Patient Mobile API cache handling
- Added no-store/no-cache headers in `apps/mobile/lib/core/network/api_client.dart`.
- Added a GET cache-busting query parameter (`__cp_t`) so Flutter web receives fresh JSON bodies instead of empty 304 responses.

### Published slot discovery
- Updated `services/api/src/modules/providers/providers.routes.ts` so provider discovery correctly reads services, care modes, and locations from the nested `ProviderProfile.services` JSON object.
- Updated `services/api/src/lib/scheduling-store.ts` so appointment availability is tolerant of patient-facing generic service/location labels:
  - `Consultation` now matches specialty consultations such as `Cardiology Consultation`.
  - `Follow-up Visit` now matches service labels containing `Follow-up`.
  - generic clinic labels now match in-person provider slots.
  - virtual/online labels now match telehealth slots.
- Updated `services/api/prisma/reset-pilot-seed.ts` to store `serviceMode: Both` plus actual in-person and virtual locations in provider metadata for future resets.

### Provider/Admin web stability
- Removed the deprecated `eslint` key from `apps/provider/next.config.mjs` to avoid Next.js 16 warnings/restarts.
- Added sign-in redirect guards for Provider and Admin so `/sign-in?next=/sign-in?...` and `/auth/sign-in?next=/auth/sign-in?...` loops are not created.

## Validation
- `npm run build:backend` passed.
- `npm run build:provider` compiled and generated all Provider routes. The command wrapper timed out after route generation while waiting for process exit; the captured log shows successful compile and route generation.
- Flutter/Dart SDK is unavailable in this execution environment, so the mobile app was validated statically.

## Recommended local steps
After extracting the package:

```powershell
npm install
npm run build:backend
npm run db:reset:pilot
npm run dev:api
npm run dev:provider
cd apps/mobile
flutter run -d web-server --web-hostname localhost --web-port 8082 --dart-define=API_BASE_URL=http://localhost:4000
```

If the database already has V21 seed data and you want the new location/service metadata in provider profiles, run `npm run db:reset:pilot` again.
