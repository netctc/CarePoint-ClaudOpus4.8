# Changelog V36 to V37

Added:

- `platform.vendor_resilience_review`
- `platform.knowledge_transfer_readiness_review`
- Python/TypeScript contracts, policies, processors, Node prepare routes and smoke vectors.

Changed:

- Worker version bumped to `0.37.0`.
- Contract schema bumped to `2026-05-option-b-v37`.
- Contract vector count increased from 67 to 69.

Unchanged:

- Python remains advisory/dry-run for these gates.
- Node/control-plane remains owner of production mutation, authorization and external-system side effects.
