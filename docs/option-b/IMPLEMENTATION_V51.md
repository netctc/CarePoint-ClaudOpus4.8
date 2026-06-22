# CarePoint Option B Python Progressive - V51 Implementation

## Purpose

V51 is a local Python test-environment repair release. It does not add new Python worker gates; it makes the already-declared Python worker dependencies easier to install and test on Windows, macOS and Linux after V50 fixed the TypeScript API build.

## Problem addressed

A Windows validation run showed that `npm run build:api` and `python scripts/option_b/verify_python_worker.py` passed, but `python -m pytest -q services/python-worker/tests/test_worker_contracts.py --disable-warnings` failed during test collection because Starlette/FastAPI `TestClient` requires `httpx` to be installed.

## Changes

- Added `scripts/option_b/install_python_worker_deps.py`.
- Added `scripts/option_b/run_python_worker_contract_tests.py`.
- Added root npm scripts:
  - `npm run setup:python-worker`
  - `npm run test:python-worker:contracts`
- Clarified the `httpx` dependency in `services/python-worker/requirements.txt`.

## Recommended local validation flow

```bash
npm run build:api
python scripts/option_b/verify_python_worker.py
npm run setup:python-worker
npm run test:python-worker:contracts
```

On Windows, the same commands can be run from `cmd.exe` or PowerShell.
