# Care Center wired starter notes

## What is wired now

### Backend API
- Auth, session cookies, and `/api/auth/me`
- Provider directory and dashboard endpoints
- Appointments, records, messaging, telehealth, and payments
- Prisma seed data for one admin, one finance user, one provider, and one patient

### Provider web app
- Sign-in with the seeded provider account
- Live dashboard
- Live queue / appointment list
- Appointment detail and confirm action
- Patient chart with create-record action
- Messaging inbox and thread view with send-message action
- Telehealth operations with start-session action
- Billing page with settle-payment action
- Shell updated to show live identity data in the header and only expose wired navigation links

### Admin web app
- Sign-in with the seeded admin account
- Live operations dashboard
- Live booking control tower
- Live payment reconciliation and refunds views
- Live telehealth operations view
- Live audit log summary
- Shell updated to read the browser auth session and map backend roles into admin UI roles

### Patient mobile app
- Real sign-in with the seeded patient account
- Live home dashboard
- Provider search against the API
- Appointment booking + payment-intent creation
- Upcoming appointments
- Medical records
- Messaging inbox and thread view
- Telehealth waiting room
- Billing / wallet summaries

## Seed credentials
- Admin: `admin@carecenter.local` / `ChangeMe123!`
- Finance: `finance@carecenter.local` / `ChangeMe123!`
- Provider: `provider@carecenter.local` / `ChangeMe123!`
- Patient: `patient@carecenter.local` / `ChangeMe123!`

## Known limitations
- Several non-core scaffold pages still use placeholder content or the old mock data modules.
- The mobile booking flow still generates slot choices locally instead of using a dedicated provider-availability endpoint.
- The admin UI role model is mapped from backend roles at the shell level; there is not yet a unified RBAC contract shared between the backend and admin route model.
- Telehealth and payments are functional starter flows, not production integrations.
- This repo was patched structurally but not dependency-installed and build-verified end-to-end inside this environment.

## Suggested next step
1. Install dependencies and run all apps.
2. Replace the remaining static/mock pages with API-backed list/detail endpoints.
3. Add route guards and shared role contracts across admin and provider web apps.
4. Add tests for the wired flows.
