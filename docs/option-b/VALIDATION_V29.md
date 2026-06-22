# Validation V29

Run from repository root after extracting the package:

```bash
python -m compileall -q services/python-worker/carepoint_python_worker
python scripts/option_b/verify_python_worker.py
PYTHONPATH=services/python-worker python - <<'PY'
import asyncio
from carepoint_python_worker.main import contract_test_vectors_direct, contracts_manifest_direct, enqueue_job
from carepoint_python_worker.compat import model_dump
from carepoint_python_worker.models import JobEnvelope

async def main():
    manifest = model_dump(await contracts_manifest_direct(), by_alias=True, mode='json')
    assert manifest['schemaVersion'] == '2026-05-option-b-v29'
    vectors = [model_dump(v, by_alias=True, mode='json') for v in await contract_test_vectors_direct()]
    types = {v['jobType'] for v in vectors}
    assert 'platform.traffic_promotion_readiness_review' in types
    assert 'platform.evidence_retention_audit_review' in types
    for job_type in ['platform.traffic_promotion_readiness_review', 'platform.evidence_retention_audit_review']:
        env = next(v['envelope'] for v in vectors if v['jobType'] == job_type)
        result = model_dump(await enqueue_job(JobEnvelope.parse_obj(env)), by_alias=True, mode='json')
        assert result['status'] == 'succeeded'
        assert result['result']['data']['decision'] == 'pass'
    print(f'custom V29 smoke passed; vectors={len(vectors)}')
asyncio.run(main())
PY
unzip -tq CarePoint_option_B_python_progressive_v29.zip
```

Expected local validation for this package:

- Python worker package compiles.
- `verify_python_worker.py` passes.
- Contract manifest schema is `2026-05-option-b-v29`.
- V29 contract vectors execute successfully for traffic promotion readiness and evidence retention audit.
- ZIP integrity validates with `unzip -tq`.

The full pytest suite is included, including V29 tests, and should be executed in CI/staging. In this packaging container, pytest emitted a pass for the targeted V29 test but did not exit cleanly before the container timeout, so CI should be the source of truth for full pytest completion.

External CI/staging still needs real dependencies:

```bash
npm ci
npm run build:contracts
npm run build:api
PYTHONPATH=services/python-worker pytest -q services/python-worker/tests/test_worker_contracts.py --disable-warnings
```
