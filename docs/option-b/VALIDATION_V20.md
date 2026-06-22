# Option B V20 Validation

Run:

```bash
npm run check:secrets --silent
npm run verify:workspace --silent
npm run verify:python-worker --silent
cd services/python-worker && python3 -m pytest -q
```

Expected Python result: all tests pass, including V20 domain migration readiness and cutover plan tests.

In a full dev/CI environment, also run:

```bash
npm ci
npm run build:contracts
npm run build:api
```
