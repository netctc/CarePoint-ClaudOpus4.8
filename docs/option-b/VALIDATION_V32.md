# Validation V32

Validation performed for the V32 package:

```bash
python -m compileall -q services/python-worker/carepoint_python_worker
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 PYTHONPATH=services/python-worker pytest -q services/python-worker/tests/test_worker_contracts.py --disable-warnings
PYTHONPATH=services/python-worker python scripts/option_b/verify_python_worker.py
unzip -tq CarePoint_option_B_python_progressive_v32.zip
```

Observed local result:

```text
106 tests collected/passing
Option B Python worker v32 verification passed.
No errors detected in compressed data of CarePoint_option_B_python_progressive_v32.zip.
```

## External CI/staging validation still required

The full TypeScript build requires real Node dependencies and should be certified in CI/staging:

```bash
npm ci
npm run build:contracts
npm run build:api
```

## Safety notes

- Python remains dry-run/advisory for both V32 gates.
- Python does not mutate rollout state, privacy/compliance systems, artifact ACLs, runbooks, tickets, incidents or paging systems.
- Inputs must be sanitized metadata: gate decisions, artifact ids, checksums, piiClass labels, owner acknowledgements and drill outcomes. Do not submit PHI, raw logs, secrets or tokens.
