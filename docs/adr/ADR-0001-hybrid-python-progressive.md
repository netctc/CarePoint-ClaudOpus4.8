# ADR-0001: Hybrid Python progressive adoption

Date: 2026-05-05
Status: Accepted for implementation v1

## Context

The architecture assessment identified a healthy modular monolith foundation, with Node/Express, Prisma/PostgreSQL, Redis, Socket.IO, Next.js, Flutter, and shared TypeScript/Zod contracts. The critical risks are repository hygiene, Prisma drift, weak build quality gates, session security, heavy admin queries, and low test coverage. These risks do not justify a full backend rewrite.

## Decision

Adopt Option B: keep the Node API as system-of-record and introduce Python progressively for workers, analytics, AI-assisted flows, exports, and future domain canaries.

The first implementation adds:

- `services/python-worker`: FastAPI service with health, readiness, manifest, shadow recording, and job enqueue endpoints.
- Celery-ready placeholder worker using Redis.
- Node bridge under `/api/hybrid-python` with feature flags, routing preview, canary selection, and shadow mode.
- Shared job envelope contracts in `packages/contracts`.
- Docker Compose wiring for local and Dokploy deployments.
- Verification script for CI.

## Guardrails

- Python does not own database tables in v1.
- Python receives minimized payloads only.
- `HYBRID_PYTHON_ENABLED=false` and `HYBRID_PYTHON_CANARY_PERCENT=0` are the default rollout settings.
- Production must set `PYTHON_SERVICES_SHARED_SECRET` and `PYTHON_WORKER_REQUIRE_SHARED_SECRET=true`.
- Domain migration requires a separate ADR, dual-run evidence, rollback plan, SLOs, and audit/security review.

## Rollback

Set:

```bash
HYBRID_PYTHON_ENABLED=false
HYBRID_PYTHON_CANARY_PERCENT=0
HYBRID_PYTHON_SHADOW_MODE=false
```

The Node API remains functional without the Python service because v1 introduces only additive bridge routes.
