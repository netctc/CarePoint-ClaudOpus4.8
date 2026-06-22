# Changelog V27 -> V28

## Added

- `platform.production_canary_observation_review` for aggregate production canary telemetry review.
- `platform.incident_response_readiness_review` for incident/on-call/escalation/runbook readiness review.
- Python processors, policies, routes, contracts and contract vectors for both jobs.
- Node bridge helper functions and prepare routes for both jobs.
- V28 implementation and validation documentation.

## Changed

- Python worker version: `0.27.0` -> `0.28.0`.
- Contract manifest schema: `2026-05-option-b-v27` -> `2026-05-option-b-v28`.

## Safety

- Both new jobs are advisory and dry-run-only.
- Python does not mutate canary state, route traffic, page responders, alter on-call schedules or modify external tickets.
