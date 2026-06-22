# Changelog V26 to V27

V27 is a cumulative stage-closure release built directly on the delivered V26 artifact.

## Added

- `platform.ci_staging_validation_review`
- `platform.release_closure_review`
- Python processors for both V27 gates
- Python policies for both V27 gates
- Python contract definitions and contract test vectors for both V27 gates
- TypeScript schemas for both V27 prepare payloads
- Node bridge helper functions for both V27 gates
- Node bridge prepare routes:
  - `/platform/ci-staging/validation/review/prepare`
  - `/platform/release/closure/review/prepare`
- smoke tests for V27 pass decisions
- manifest coverage tests for V27 contracts and vectors
- updated Option B verifier to include V25, V26 and V27 additions

## Changed

- Python worker version: `0.26.0` -> `0.27.0`
- contract manifest schema: `2026-05-option-b-v26` -> `2026-05-option-b-v27`
- contract test vector count: `47` -> `49`
- V27 validation docs now explicitly separate local Python verification from CI/staging TypeScript build certification.

## Safety notes

V27 does not move productive ownership to Python. The new gates are advisory and dry-run-only. CI, deployment, approval, rollback and release closure remain Node/CI/operator-owned.
