# CarePoint Option B - Validation V12

Validated checks:

```bash
npm run check:secrets --silent
npm run verify:workspace --silent
npm run verify:python-worker --silent
cd services/python-worker && python3 -m pytest -q
```

Expected Python result:

```text
42 passed
```

TypeScript build should be validated in a full dev/CI environment with:

```bash
npm ci
npm run build:contracts
npm run build:api
```
