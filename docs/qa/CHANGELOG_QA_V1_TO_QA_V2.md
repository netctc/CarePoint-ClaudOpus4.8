# Changelog - QA-V1 to QA-V2

## Added

- Admin functional QA plan.
- Admin configuration validation audit.
- Admin scenario evidence template.
- QA-V2 validation documentation.
- `scripts/qa/scan-admin-functional-config.mjs`.
- `validation/qa/qa-v2-admin-functional-config-audit.json`.
- `validation/qa/qa-v2-admin-functional-test-plan.json`.

## Updated

- `package.json` now includes `audit:qa:admin-config`.
- `audit:qa` now runs QA-V1 and QA-V2 audits.
- `docs/qa/QA_PHASE_MANIFEST.json` points to QA-V2 as the current delivery.
- `docs/qa/QA_PHASE_ROADMAP.md` marks QA-V2 complete and QA-V3 next.

## Unchanged

- Backend contracts.
- Python worker.
- Database schema.
- Application runtime code.
- UX-V6 closure evidence.

## Next

QA-V3 should validate Provider functional QA and clinical workflow readiness.
