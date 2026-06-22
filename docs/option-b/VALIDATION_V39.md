# Validation V39

Run from repository root:

```bash
python -m compileall -q services/python-worker/carepoint_python_worker
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 PYTHONPATH=services/python-worker python -m pytest -q services/python-worker/tests/test_worker_contracts.py --disable-warnings
PYTHONPATH=services/python-worker python scripts/option_b/verify_python_worker.py
unzip -tq CarePoint_option_B_python_progressive_v39.zip
```

Expected local result for this package:

- Python compile succeeds
- worker contract tests pass
- Option B worker verification prints `Option B Python worker v39 verification passed.`
- ZIP integrity check reports no errors

External CI/staging still must run `npm ci`, `npm run build:contracts`, and `npm run build:api` with real TypeScript dependencies.
