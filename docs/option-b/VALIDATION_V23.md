# Option B - Validation V23

Expected checks:

```bash
npm run check:secrets --silent
npm run verify:workspace --silent
npm run verify:python-worker --silent
cd services/python-worker && PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 PYTHONWARNINGS=ignore python3 -m pytest -q
unzip -tq /mnt/data/CarePoint_option_B_python_progressive_v23.zip
```

Expected Python test result after V23: `81 passed`.

The TypeScript build should be run in a development/CI environment with dependencies installed:

```bash
npm ci
npm run build:contracts
npm run build:api
```
