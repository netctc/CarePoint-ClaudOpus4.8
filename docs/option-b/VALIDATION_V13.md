# Option B - Validation V13

Run from repository root:

```bash
npm run check:secrets --silent
npm run verify:workspace --silent
npm run verify:python-worker --silent
cd services/python-worker && python3 -m pytest -q
```

Expected Python result: all worker contract tests pass.

TypeScript validation should be run in a full workspace with dependencies installed:

```bash
npm ci
npm run build:contracts
npm run build:api
```
