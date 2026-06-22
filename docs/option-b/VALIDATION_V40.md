# Validation V40

Run from repository root:

```bash
python -m compileall -q services/python-worker/carepoint_python_worker
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 PYTHONPATH=services/python-worker python -m pytest -q services/python-worker/tests/test_worker_contracts.py --disable-warnings
PYTHONPATH=services/python-worker python scripts/option_b/verify_python_worker.py
unzip -tq CarePoint_option_B_python_progressive_v40.zip
```

Expected local results for this package:

- Python worker compile passes.
- Contract test suite passes with the V40 vectors.
- `verify_python_worker.py` prints `Option B Python worker v40 verification passed.`
- ZIP integrity check reports no errors.

External CI/staging still needs dependency-backed TypeScript certification:

```bash
npm ci
npm run build:contracts
npm run build:api
```
