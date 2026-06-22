# Service API — Slot I KSA Compliance Hardening

Version: services-api-v0.9-slot-i-ksa-compliance-hardening

## Included in this wave
- patient family legal-relationship evidence controls
- telehealth patient-readiness and consent enforcement
- telehealth compliance policy snapshots
- release-gated lab verification and patient visibility rules
- controlled-medication and refill-policy checks for prescriptions
- patient record visibility filtering for released/verified artifacts only
- matching dist outputs for changed source files

## Key backend changes
- `GET/POST /api/patient/family/...`
  - relationship evidence status
  - consent status
  - dependent invite gating until evidence is verified
- `GET/PUT /api/telehealth/sessions/:sessionId/patient-readiness`
- `POST /api/telehealth/sessions/:sessionId/join`
- `PUT /api/telehealth/operations/sessions/:sessionId/compliance-policy`
- `POST /api/provider/labs/results/:resultId/verify`
- hardened `POST /api/provider/labs/results/:resultId/release`
- hardened `POST /api/provider/prescriptions/items/:prescriptionId/sign`
- hardened `GET /api/records` and `GET /api/records/:recordId` for patient-safe release filtering

## Important notes
- no runtime `.env` is packaged
- keep the existing local `services/api/.env` or `.env.local`
- this wave does not require new Prisma models for runtime behavior because the added compliance state is stored in workspace JSON or audit snapshots

## Validation performed
- transpiled changed TypeScript source files into matching `dist` JS files
- JS syntax validation (`node -c`) on the updated `dist` files

Expanded local test dataset added in this revision: 10 providers, 20 patients, denser appointments, more records, lab items, prescriptions, RPM items, alerts, messages, and seeded schedule templates.
