# CarePoint Python Worker Service

Implementation for Option B: hybrid Python progressive adoption.

This service is additive. The existing Node/Express API remains the primary owner of HTTP workflows, auth, authorization, Prisma writes, and frontend contracts. Python starts as a sidecar for async jobs, analytics, AI-assisted previews, export preparation, and canary domain pilots.

## v3 scope

v3 hardens the Python slice enough for staging-style dry-run/canary rehearsal:

- HMAC-SHA256 signed Node -> Python bridge requests with timestamp replay protection.
- Optional Redis-backed job status store so API and Celery processes share lifecycle state.
- Artifact metadata generation for dry-run export, validation and analytics workloads.
- Status aliases:
  - `GET /api/v1/jobs/{idempotencyKey}`
  - `GET /api/v1/jobs/status/{idempotencyKey}`
- Concrete processors for:
  - `admin.audit_export`
  - `admin.accounts_bulk_validate`
  - `notifications.dispatch`
  - `analytics.snapshot`
  - `ai.triage_preview`
- Celery task dispatch updates the job store through `running`, `succeeded` and `failed` states.
- The Node bridge exposes domain-specific prepare routes for audit export, bulk validation, analytics snapshot, notification planning and non-diagnostic triage preview.

## Local development

```bash
cd services/python-worker
python -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements.txt
uvicorn carepoint_python_worker.main:app --reload --host 0.0.0.0 --port 8010
```

Run the Celery worker when `PYTHON_WORKER_QUEUE_ENABLED=true`:

```bash
cd services/python-worker
celery -A carepoint_python_worker.celery_app:celery_app worker --loglevel=INFO
```

## Smoke test

```bash
curl -X POST http://localhost:8010/api/v1/jobs/enqueue \
  -H 'content-type: application/json' \
  -d '{
    "jobType":"admin.audit_export",
    "idempotencyKey":"audit-export-smoke-0001",
    "dryRun":true,
    "payload":{"format":"csv","filters":{"from":"2026-01-01","to":"2026-01-31"}}
  }'

curl http://localhost:8010/api/v1/jobs/status/audit-export-smoke-0001
```

## Contract boundaries

Inbound traffic must use the Node bridge first unless a route is explicitly approved for direct service-to-service calls. The service accepts the same job envelope contract exported from `packages/contracts`.

Node must continue to own:

- Auth and RBAC.
- Object and organization scope.
- Final export delivery and signed URLs.
- Audit event persistence.
- Any Prisma write until a domain ADR transfers ownership.

## Security defaults

- In production, set `PYTHON_SERVICES_SHARED_SECRET`, `PYTHON_WORKER_REQUIRE_SHARED_SECRET=true`, and `PYTHON_WORKER_REQUIRE_SIGNATURE=true`.
- Use `PYTHON_WORKER_SIGNATURE_TOLERANCE_SECONDS=300` unless clock drift requires a lower staging-tested value.
- Do not send PHI/PII unless the job type has an approved data minimization policy.
- Keep `HYBRID_PYTHON_ENABLED=false` and `HYBRID_PYTHON_CANARY_PERCENT=0` until the Node bridge status endpoint is healthy in staging.
- Keep live non-dry-run Python jobs disabled until Redis job status, rollback runbooks and dashboards are approved.

## Redis status store

For multi-process staging:

```bash
PYTHON_WORKER_QUEUE_ENABLED=true
PYTHON_WORKER_JOB_STATUS_REDIS_ENABLED=true
PYTHON_WORKER_JOB_STATUS_TTL_SECONDS=86400
REDIS_URL=redis://redis:6379
```

## Artifact storage

Dry-run artifacts are written under `PYTHON_WORKER_ARTIFACT_STORAGE_DIR` and returned as metadata only. Node remains responsible for access checks and signed delivery. The artifact metadata includes `artifactId`, content type, byte size, SHA-256 hash, storage path and expiration timestamp.


## V4 canary and shadow comparison control plane

V4 adds migration guardrails for progressive Python adoption:

- `POST /api/v1/shadow/comparisons/record` records a sanitized Node-vs-Python result comparison.
- `GET /api/v1/shadow/comparisons` lists recent comparisons and mismatch rates.
- `GET /api/v1/canary/gate` returns `advance`, `hold` or `rollback` based on job failures and comparison mismatches.
- `POST /api/v1/artifacts/gc?dryRun=true` scans expired artifacts; set `dryRun=false` to delete.

The comparison endpoint rejects secrets, bearer tokens and high-risk clinical fields. Use it only with minimized output summaries, never raw charts, notes, prescriptions or token-bearing payloads.

## V5 contracts and rollout readiness

V5 adds contract-first rollout guardrails:

- `GET /api/v1/contracts/manifest` returns the versioned contract manifest and `contractHash`.
- `GET /api/v1/contracts/test-vectors` returns sanitized `JobEnvelope` examples for all approved job types.
- `POST /api/v1/contracts/validate` validates a job envelope against policy without enqueueing or writing job state.
- `GET /api/v1/rollout/readiness` combines canary gate evidence, contract canary caps and bridge-signature readiness to recommend `advance`, `hold` or `rollback`.

Node exposes matching bridge routes under `/api/hybrid-python/contracts/*` and `/api/hybrid-python/rollout/readiness`.

## V5 rollout controller and deterministic canary assignment

V5 also adds an operational rollout controller:

- `GET /api/v1/canary/rollout` returns the current persisted rollout state.
- `POST /api/v1/canary/rollout/plan` creates or previews a staged canary plan.
- `POST /api/v1/canary/rollout/advance` advances to the next stage only when the canary gate allows it.
- `POST /api/v1/canary/rollout/pause`, `/resume`, and `/rollback` control staged rollout state.
- `POST /api/v1/canary/assignment` returns deterministic bucket assignment for a `subjectKey`.
- `GET /api/v1/canary/rollout/audit` returns the recent rollout audit ledger.

Set `PYTHON_WORKER_ROLLOUT_STATE_PATH` to persist rollout state across restarts. In Compose this is mounted at `/state/rollout-state.json`.


## V6: release checklist, evidence and Node assignment

V6 adds route-scoped rollout actions, a release checklist, an evidence bundle, and Node-side optional consumption of Python canary assignment. Keep the control-plane assignment flag disabled until staging has green checklist and evidence.

Key endpoints:

- `GET /api/v1/release/checklist`
- `GET /api/v1/evidence/bundle`
- `POST /api/v1/canary/assignment`

Node bridge endpoints:

- `GET /api/hybrid-python/release/checklist`
- `GET /api/hybrid-python/evidence/bundle`
- `GET /api/hybrid-python/routing-preview`

## V7 domain slices

V7 adds four safe domain slices for the progressive Python path:

- `admin.accounts_read_model` prepares sanitized account list read models from Node-prefiltered rows.
- `admin.provider_role_reconcile` produces advisory schema/migration drift reports for provider-role catalog work.
- `scheduling.availability_snapshot` computes availability aggregates from hashed provider/resource windows.
- `messaging.reminder_plan` creates dry-run reminder batches from recipient hashes and never sends messages.

The executable contract manifest is `2026-05-option-b-v11`, and the Python service version is `0.11.0`.

Node bridge routes:

- `POST /api/hybrid-python/admin/accounts/read-model/prepare`
- `POST /api/hybrid-python/admin/provider-roles/reconcile/prepare`
- `POST /api/hybrid-python/scheduling/availability/snapshot/prepare`
- `POST /api/hybrid-python/messaging/reminders/plan/prepare`

Keep provider role reconciliation and reminder planning shadow-only until operational approval. Account read models and scheduling snapshots may progress to canary only after shadow comparison evidence is clean.


## V8 workloads

- `billing.payment_reconcile`: advisory payment reconciliation from Node-prefiltered billing metadata only.
- `clinical.records_access_audit`: dry-run clinical access-risk indicators from hashed audit metadata only.


## V9 platform advisory workloads

- `platform.db_index_advisory`: dry-run-only index candidate report from schema/query metadata.
- `platform.slo_regression_report`: dry-run-only SLO regression report from aggregate telemetry samples.

These workloads support canary evidence and performance remediation without moving Prisma ownership away from Node.


## V10 release gates

V10 adds `platform.contract_replay` and `platform.privacy_preflight` as dry-run-only release gates. Contract replay executes sanitized built-in vectors and writes a CI-ready artifact. Privacy preflight evaluates payload key shapes before bridge enqueue and blocks secret, token, card or PHI-like keys without accepting raw payload values.


## V11 release decision and rollback drill

V11 adds `platform.release_decision` and `platform.rollback_drill` jobs. These jobs are dry-run-only, metadata-only release gates: Python produces advisory artifacts from sanitized evidence, while Node/Express, CI and operators remain owners of deployment, route rollback and production traffic.


## V14 operational handoff and incident simulation

V14 adds `platform.operational_handoff` and `platform.incident_simulation`. Both are dry-run-only, metadata-only platform jobs intended to help release operators verify handoff readiness and rehearse incident response without mutating rollout state or sending notifications.


## V14: Capacity and alert release gates

- `platform.capacity_plan`: advisory worker capacity plan from aggregate workload/queue metrics.
- `platform.alert_policy_review`: advisory alert coverage review for Python down, errors, p95 latency, queue backlog, shadow mismatch, privacy block and artifact leak.

Both jobs are dry-run-only and generate sanitized JSON artifacts for change-ticket evidence.


## V15: Dependency and production readiness gates

- `platform.dependency_readiness`: advisory release gate for required service/dependency health metadata.
- `platform.production_readiness`: final advisory gate that aggregates sanitized release evidence before canary promotion.

Both jobs are dry-run-only and generate sanitized JSON artifacts for change-ticket evidence.


## V16 compliance gates

V16 adds dry-run advisory gates for `platform.data_retention_review` and `platform.audit_trail_review`. They evaluate retention policy metadata, artifact summaries, GC dry-run evidence and operational audit event metadata. Python does not delete artifacts, mutate rollout state, write audit logs or approve production releases.


## V17 security and supply chain gates

V17 adds dry-run advisory gates for `platform.security_posture_review` and `platform.supply_chain_review`. These gates evaluate sanitized security-control evidence, finding counts, SBOM/lockfile/image-scan presence and vulnerability totals before increasing canary. Python does not mutate auth, RBAC, cookies, CORS, WAF, dependencies, packages, images or registries.


## V18 release gates

V18 adds two dry-run/advisory gates for the progressive Python rollout:

- `platform.schema_migration_rehearsal`: evaluates sanitized Prisma/schema migration rehearsal metadata, drift evidence, rollback plans and backfill plans. Python does not run migrations.
- `platform.backup_restore_drill`: evaluates backup freshness, restore drill status, integrity checks, RPO and RTO metadata. Python never reads backup contents or restores data.

Node/Express and CI remain the owners of migrations, production data, deployment and rollback switches.


## V19 gates

- `platform.observability_coverage_review` checks trace/request correlation, p95/error/queue signals and dashboards.
- `platform.feature_flag_review` checks kill switch, shadow mode, canary cap, base URL and signed bridge requirement.


## V20 domain cutover gates

- `platform.domain_migration_readiness`: validates sanitized evidence before increasing canary or changing domain ownership.
- `platform.cutover_plan`: creates a dry-run staged cutover plan with rollback triggers and verification steps.

Both jobs are advisory and dry-run-only; Node/CI/operators own production promotion and rollback.


## V22 additions

- `platform.owner_registry_review` validates sanitized owner matrix metadata before cutover.
- `platform.post_cutover_monitor` reviews aggregate post-cutover telemetry and produces advisory rollback/hold/continue output.


### V22 operational maturity gates

- `platform.legacy_path_decommission`: dry-run readiness review before removing legacy Node/hybrid paths after stable cutover. It checks zero traffic, fallback evidence, owner approval and rollback triggers, and does not mutate routes or code.
- `platform.steady_state_operations_review`: dry-run operations review for runbooks, dashboards, alerts, on-call, incident history and aggregate SLO evidence before declaring a migrated slice steady-state.


## V23 - Queue resilience and artifact integrity gates

Version 0.23.0 adds two advisory release gates:

- `platform.queue_resilience_review` checks aggregate queue depth, oldest queued item age, consumers, retry policy, DLQ evidence, idempotency and drain estimates before expanding Python-backed worker canary. It never mutates Redis, Celery, worker counts or rollout state.
- `platform.artifact_integrity_review` checks generated artifact metadata for `sha256`, `sizeBytes`, `redactionApplied`, `piiClass` and `expiresAt`. It never reads artifact payloads or changes artifact delivery permissions; Node remains the owner of access control and downloads.

The executable contract manifest is `2026-05-option-b-v23`, and the Python service version is `0.23.0`.


## Version 0.24.0 - runbook and support readiness gates

Adds `platform.runbook_freshness_review` and `platform.support_escalation_review` as dry-run/advisory gates. Manifest: `2026-05-option-b-v24`; service version: `0.24.0`. Python does not mutate docs, ticketing, on-call or rollout state.
