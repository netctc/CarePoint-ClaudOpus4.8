# Option B Python Progressive V36 Validation

Validated locally in the generated package workspace.

## Python syntax

```bash
python -m compileall -q services/python-worker/carepoint_python_worker
```

Result: passed.

## Contract and worker tests

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 PYTHONPATH=services/python-worker python -m pytest -q services/python-worker/tests/test_worker_contracts.py --disable-warnings
```

Result: passed.

Coverage includes the new V36 smoke tests for:

- `platform.post_incident_learning_review`
- `platform.tech_debt_governance_review`
- contract manifest inclusion
- 67 accumulated contract vectors

## Structural worker verification

```bash
PYTHONPATH=services/python-worker python scripts/option_b/verify_python_worker.py
```

Result:

```text
Option B Python worker v36 verification passed.
```

## ZIP integrity

Run after packaging:

```bash
unzip -tq CarePoint_option_B_python_progressive_v36.zip
```

Expected result: no errors detected.

## External CI/staging validation still required

The TypeScript build requires dependencies installed by CI/staging:

```bash
npm ci
npm run build:contracts
npm run build:api
```

This local package validates Python, contract manifest generation, Node route presence and ZIP integrity, but does not certify a full TypeScript build in this container.
