# Validation V54

Run npm ci --ignore-scripts, npm run build:api, python scripts/option_b/verify_python_worker.py, and the Python worker contract tests. Validate ZIP integrity with unzip -tq.

## Scope

- platform.stage_closure_certification_review
- platform.post_closure_operational_transition_review

## Safety

Both controls are dry-run/advisory and metadata-only. They do not mutate release, risk, ownership, support, monitoring, roadmap or production systems.
