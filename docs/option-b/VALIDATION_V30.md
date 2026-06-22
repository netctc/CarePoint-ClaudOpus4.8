# Validation V30

Recommended validation commands:

```bash
python -m compileall -q services/python-worker/carepoint_python_worker
PYTHONPATH=services/python-worker pytest -q services/python-worker/tests/test_worker_contracts.py --disable-warnings
python scripts/option_b/verify_python_worker.py
unzip -tq CarePoint_option_B_python_progressive_v30.zip
```

Expected local smoke results for this package:

- Python compile passes.
- V30 contract vectors are present for `platform.slo_error_budget_review` and `platform.auto_rollback_safeguard_review`.
- The SLO/error-budget smoke returns `decision=pass` on clean aggregate metrics.
- The auto-rollback safeguard smoke returns `decision=pass` with ready triggers, manual override, Node fallback, kill switch, runbook and drill metadata.

External CI/staging remains source of truth for full TypeScript builds and end-to-end bridge validation:

```bash
npm ci
npm run build:contracts
npm run build:api
```
