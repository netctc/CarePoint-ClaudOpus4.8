# Option B Python Progressive V28 Validation

Validated locally in the generated package with:

```bash
python -m compileall -q services/python-worker/carepoint_python_worker
PYTHONPATH=. pytest -q services/python-worker/tests/test_worker_contracts.py --disable-warnings
python scripts/option_b/verify_python_worker.py
unzip -tq CarePoint_option_B_python_progressive_v28.zip
```

Expected results:

- Python package compiles.
- Contract tests include V28 smoke coverage for both new gates.
- Manifest schema is `2026-05-option-b-v28`.
- ZIP integrity check reports no compressed-data errors.

External validation still required in CI/staging:

```bash
npm ci
npm run build:contracts
npm run build:api
```

The local container does not certify the TypeScript build unless dependencies are installed.
