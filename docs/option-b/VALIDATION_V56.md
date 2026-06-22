# Option B Hybrid Python Progressive - Validation V56

Run from the repository root:

```bash
python -m compileall -q services/python-worker/carepoint_python_worker
PYTHONPATH=services/python-worker python scripts/option_b/verify_python_worker.py
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 PYTHONPATH=services/python-worker python -m pytest -q services/python-worker/tests/test_worker_contracts.py --disable-warnings
unzip -tq CarePoint_option_B_python_progressive_v56.zip
```

Expected Python validation output:

```text
Option B Python worker v56 verification passed.
169 Python worker contract tests passing.
```

Node build validation in a full local environment:

```bash
npm install
npm run build:api
```

This container may not have `node_modules`; if `zod` is missing, run `npm install` before the API build.
