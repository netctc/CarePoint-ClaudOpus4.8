# CarePoint Option B - Validation V17

Validation performed for V17:

```bash
npm run check:secrets --silent
npm run verify:workspace --silent
npm run verify:python-worker --silent
cd services/python-worker && python3 -m pytest -q
unzip -tq /mnt/data/CarePoint_option_B_python_progressive_v17.zip
```

Expected Python result: `62 passed`.

The TypeScript build should be validated in CI/dev with `npm ci && npm run build:contracts && npm run build:api`.
