# CarePoint Option B - Validation V19

Recommended checks:

```bash
npm run check:secrets --silent
npm run verify:workspace --silent
npm run verify:python-worker --silent
cd services/python-worker && python3 -m pytest -q
```

Expected Python result in this package: `69 passed`.

The TypeScript build should be validated in CI/dev with `npm ci && npm run build:contracts && npm run build:api`.
