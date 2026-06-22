# Changelog QA-V2 to QA-V3

## Added

- Provider functional QA scanner: `scripts/qa/scan-provider-functional-workflows.mjs`.
- Provider workflow audit report: `validation/qa/qa-v3-provider-functional-workflows-audit.json`.
- Provider functional test plan: `validation/qa/qa-v3-provider-functional-test-plan.json`.
- Provider QA documentation and clinical workflow validation guidance.

## Updated

- `package.json` with `audit:qa:provider-workflows`.
- `audit:qa` now runs QA-V1, QA-V2, and QA-V3 scanners.
- QA phase manifest and roadmap now identify QA-V4 as the next delivery.

## Not changed

- Backend contracts.
- Python worker logic.
- Database schema.
- Application runtime behavior.
