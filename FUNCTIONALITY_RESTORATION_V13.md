# CarePoint V13 - Provider Login + Shell + Dashboard Redesign

## Strategy
This version continues from V12.1 and keeps **V6 as the functional source of truth**. The V7/V11 redesigns are not used as code bases. They are used only as visual references.

## Scope delivered
V13 applies the new shared provider design layer to:

1. Provider login
   - Preserved existing provider authentication logic.
   - Preserved managed-device confirmation.
   - Preserved risk acknowledgement.
   - Preserved privileged challenge start.
   - Preserved verification code step.
   - Preserved resend-code behavior.
   - Preserved enterprise SSO startup when available.
   - Preserved browser-session persistence and redirect behavior.

2. Provider shell
   - Redesigned sidebar visually while keeping all functional provider routes.
   - Redesigned top header visually while preserving providerApi.me() session lookup.
   - Preserved quick links, language switcher, notification/sync controls, emergency triage entry, and live/degraded connection state.

3. Provider dashboard
   - Preserved providerApi.dashboard() loader.
   - Preserved providerApi.providerAuditPacketSummary(30) loader.
   - Preserved mock fallback via getDashboardData().
   - Preserved dashboard loading/error/fallback state behavior.
   - Preserved schedule/queue links to appointment details.
   - Preserved alerts, governance notes, governed refill summary, and subject context summary.
   - Replaced only the visual structure with reusable V12 design primitives.

## Explicit non-scope
The following modules were not redesigned in V13 and remain functionally based on V6/V12.1:
- Provider queue
- Provider telehealth
- Provider patients/chart
- Provider calendar/schedule internals
- Provider messages
- Provider settings/team
- Admin application

These should be handled in later phases, page by page.

## Validation
Executed from `apps/provider`:

```bash
npm run build
```

Result: build completed successfully.

## Notes
The build emits warnings about the legacy `eslint` key in `next.config.mjs`. This is pre-existing configuration drift and does not block the provider build.
