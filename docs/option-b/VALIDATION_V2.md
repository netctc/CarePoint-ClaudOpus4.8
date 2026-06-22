# Option B v2 validation notes

Date: 2026-05-05

## Checks passed in this package

```bash
npm run check:secrets --silent
npm run verify:workspace --silent
npm run verify:python-worker --silent
cd services/python-worker && python -m pytest -q
```

Python worker tests cover:

- Service metadata.
- Manifest capability listing.
- Audit export dry-run preparation and job status lookup.
- Idempotency replay.
- Bulk account validation row errors.
- Non-diagnostic AI triage preview.
- Safety guard that rejects non-dry-run jobs unless queue mode is enabled.

## Checks requiring a normal Node dependency install

The full TypeScript build requires `node_modules` to be installed from `package-lock.json`. In a clean execution environment without `zod` installed, `npm run build:contracts` cannot complete. Run the following in CI or a developer workstation:

```bash
npm ci
npm run build:contracts
npm run build:api
npm run build:admin
npm run build:provider
```

## Rollback remains unchanged

```bash
HYBRID_PYTHON_ENABLED=false
HYBRID_PYTHON_CANARY_PERCENT=0
HYBRID_PYTHON_SHADOW_MODE=false
```

v2 does not transfer database ownership to Python.
