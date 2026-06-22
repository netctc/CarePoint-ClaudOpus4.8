# Validation V33

Validation performed for the V33 package:

```bash
python -m compileall -q services/python-worker/carepoint_python_worker
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 PYTHONPATH=services/python-worker pytest -q services/python-worker/tests/test_worker_contracts.py --disable-warnings
PYTHONPATH=services/python-worker python scripts/option_b/verify_python_worker.py
unzip -tq CarePoint_option_B_python_progressive_v33.zip
```

Expected result:

```text
109 tests collected/passing
Option B Python worker v33 verification passed.
No errors detected in compressed data of CarePoint_option_B_python_progressive_v33.zip.
```

## External validation still required

The TypeScript build must still be certified in CI/staging with real dependencies:

```bash
npm ci
npm run build:contracts
npm run build:api
```
