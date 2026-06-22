# Option B V10 - Release gates: contract replay and privacy preflight

V10 adds two Platform & DevOps slices to improve release confidence before increasing canary traffic.

## Added

- `platform.contract_replay`: dry-run CI gate that replays sanitized built-in contract vectors and writes a redacted artifact.
- `platform.privacy_preflight`: dry-run payload-shape gate that flags secret/token/card/PHI-like keys before any raw payload crosses the Python bridge.
- Node bridge routes: `/platform/contracts/replay/prepare` and `/platform/privacy/preflight/prepare`.
- Contracts and policy manifest updated to schema `2026-05-option-b-v10`.

## Ownership

Node remains owner of API, auth, RBAC/ABAC, Prisma, productive reads/mutations and rollout switches. Python remains a controlled worker/control-plane component.
