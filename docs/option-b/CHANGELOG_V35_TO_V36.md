# Changelog V35 to V36

## Added

- `platform.post_incident_learning_review`
- `platform.tech_debt_governance_review`
- Python payload models and processors for both gates
- Python policies for minimized, dry-run-only evidence review
- Python contract definitions and contract vectors for both gates
- Node bridge helper functions
- Node prepare routes
- TypeScript/Zod prepare schemas
- V36 validation and implementation docs

## Changed

- Worker version bumped to `0.36.0`.
- Contract schema bumped to `2026-05-option-b-v36`.
- Contract vector count increased from 65 to 67.
- Manifest capabilities now include post-incident learning and technical-debt governance reviews.

## Not changed

- Python still does not own production writes, incident-system mutation, ticket mutation, backlog mutation, waiver approval or traffic changes.
- Node remains the control plane for auth, RBAC/ABAC, object scope, Prisma writes and operational execution.
