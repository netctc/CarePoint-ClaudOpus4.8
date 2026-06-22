# Option B Python Progressive V27 Validation

Validated locally in the generated V27 package:

```bash
cd services/python-worker
python -m compileall -q carepoint_python_worker
PYTHONPATH=. pytest -q tests/test_worker_contracts.py --disable-warnings
```

Observed result:

```text
........................................................................ [ 79%]
...................                                                      [100%]
```

Collected test count:

```text
tests/test_worker_contracts.py: 91
```

Additional verifier:

```bash
python scripts/option_b/verify_python_worker.py
```

Observed result:

```text
Option B Python worker v27 verification passed.
```

Validated coverage:

- Python package compiles.
- 91 cumulative worker/contract tests pass.
- contract manifest schema version is `2026-05-option-b-v27`.
- contract vector count is 49.
- `platform.ci_staging_validation_review` passes with complete sanitized CI/staging evidence.
- `platform.release_closure_review` passes with clean required gates, evidence bundle and approval.
- Node bridge contains the V27 prepare routes and helper calls.
- TypeScript contracts contain the V27 Zod schemas.
- Option B verifier recognizes V25, V26 and V27 route/schema/helper additions.

## TypeScript build status

The TypeScript build was not certified in this container because dependencies are not installed. Running:

```bash
npm run build:contracts
```

failed with:

```text
Cannot find module 'zod' or its corresponding type declarations.
```

This is an environment dependency issue (`node_modules` absent), not a V27-specific TypeScript syntax finding. CI/staging should run:

```bash
npm ci
npm run build:contracts
npm run build:api
```

## Required staging closure sequence

Before declaring the stage closed in a real environment:

1. Run `npm ci` with the repository lockfile.
2. Run `npm run build:contracts`.
3. Run `npm run build:api`.
4. Run `npm run test:python-worker` or the equivalent CI worker test step.
5. Run Docker/Compose smoke with Node API, Python API, Python Celery and Redis.
6. Validate HMAC: unsigned requests are rejected and signed requests are accepted.
7. Validate Redis status persistence after partial restart.
8. Validate artifact registry TTL, checksum, redaction metadata and protected download behavior.
9. Validate deterministic canary assignment, gate and rollback.
10. Generate sanitized evidence bundle and run `platform.ci_staging_validation_review`.
11. Run `platform.release_closure_review` only after V25/V26 gates and CI/staging validation are clean.
