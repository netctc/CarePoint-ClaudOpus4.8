# Changelog V25 to V26

## Added

- `platform.access_control_review` advisory release gate
- `platform.data_quality_review` advisory release gate
- Python payload models, processors, policies and contract definitions
- TS Zod prepare schemas
- Node bridge prepare routes
- Python enqueue helpers in `services/api/src/lib/hybrid-python.ts`
- contract test vectors for V25 and V26 gates
- smoke tests for V26 decisions and manifest coverage

## Preserved

- V25 FinOps and environment parity gates
- V24 and earlier worker/control-plane behavior
- Node ownership of auth, object scope, Prisma writes, source-data reads, traffic promotion and rollback

## Validation status

- Python syntax and smoke tests are expected to pass locally.
- TypeScript build must be run in CI/staging with `npm ci` because this container does not provide a reliable installed dependency tree.
