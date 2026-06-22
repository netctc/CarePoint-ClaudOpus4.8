# CarePoint Option B - Validation V16

Validation performed for V16:

```bash
npm run check:secrets --silent
npm run verify:workspace --silent
npm run verify:python-worker --silent
cd services/python-worker && python3 -m pytest -q
unzip -tq /mnt/data/CarePoint_option_B_python_progressive_v16.zip
```

Expected Python result: `58 passed`.

TypeScript build should be validated in CI/dev with:

```bash
npm ci
npm run build:contracts
npm run build:api
```
