# HSP Role Implementation Phase 2

This phase extends the initial HSP account-model implementation with explicit inter-center consent governance.

## Added in Service API
- New JSON-backed consent grant store:
  - `services/api/src/lib/hsp-consent-store.ts`
  - `services/api/data/hsp-consents.json`
- HSP access summary now reflects recorded active consent grants instead of relying only on inferred fallback facilities.
- New endpoints under `/api/access/hsp`:
  - `GET /api/access/hsp/consent-grants`
  - `POST /api/access/hsp/consent-grants`
  - `POST /api/access/hsp/consent-grants/:grantId/revoke`
- `GET /api/access/hsp/organization-summary` now returns grant counts.

## Added in Admin Web
- New governance page:
  - `/portal/access/hsp-consents`
- Admins can review existing inter-center consent grants.
- Admins can create or revoke consent grants from the portal.
- Route added to the admin navigation model.

## Added in Provider Web
- New provider settings page:
  - `/portal/settings/access`
- Shows HSP model, access scope, consented facilities, restrictions, and recorded grants.
- Linked from the provider settings index.

## Added in Provider Mobile
- New page:
  - `/settings/hsp-access`
- Shows HSP model, facility scope, restrictions, consented facilities, and grants.
- Linked from provider settings.

## Notes
- This phase starts real explicit consent governance, but it does not yet enforce per-route facility-domain filtering across every provider API endpoint.
- The current store is file-backed for workspace implementation speed and local testing.
