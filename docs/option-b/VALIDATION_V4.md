# Option B - Validation V4

Date: 2026-05-05

## Commands executed

```bash
npm run check:secrets --silent
npm run verify:workspace --silent
npm run verify:python-worker --silent
cd services/python-worker && python3 -m pytest -q
```

## Results

```text
S0 secret/artifact check passed: no committed .env, leaked S0 credentials, zip, .old or copy artifacts detected.
S0 workspace verification passed.
Option B Python worker v4 verification passed.
15 passed
```

## Scope validated

- Python worker package compiles.
- Required Python worker files exist.
- Node bridge files exist.
- `packages/contracts` exports V4 schemas.
- Node bridge routes include shadow comparisons, canary gate and artifact GC.
- Existing V3 behavior still works: job lifecycle, audit export plan, account bulk validation, metrics, HMAC signing helpers and policy rejection.
- V4 behavior works: result comparison, mismatch classification, canary gate and artifact retention scan.

## Not certified in this environment

- Full TypeScript build with `npm ci` and workspace `node_modules`.
- Real Redis queue execution.
- Real production traffic canary.
- Database-backed domain migration.
