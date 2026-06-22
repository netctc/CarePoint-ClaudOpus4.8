# Option B V11 validation

Run:

```bash
npm run check:secrets --silent
npm run verify:workspace --silent
npm run verify:python-worker --silent
cd services/python-worker && python3 -m pytest -q
```

Expected: v11 verification passes and Python tests include release decision plus rollback drill coverage.
