from __future__ import annotations

from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response, status
from fastapi.responses import FileResponse, PlainTextResponse

from . import __version__
from .artifacts import artifact_store
from .canary import evaluate_canary_gate
from .contracts import build_contract_manifest, build_contract_test_vectors, build_rollout_readiness_report, validate_contract_envelope
from .celery_app import celery_app
from .compat import model_dump
from .config import get_settings
from .jobs.processors import process_job
from .jobs.shadow_store import shadow_store
from .jobs.shadow_compare_store import shadow_comparison_store
from .jobs.store import job_store
from .metrics import Timer, metrics as worker_metrics
from .models import (
    CanaryAssignment,
    CanaryAssignmentRequest,
    CanaryGateDecision,
    CanaryRolloutAction,
    CanaryRolloutPlanRequest,
    CanaryRolloutState,
    ContractManifest,
    ContractTestVector,
    ContractValidationReport,
    DependencyHealth,
    EvidenceBundle,
    JobAccepted,
    JobEnvelope,
    JobRecord,
    JobStatus,
    JobType,
    ReleaseChecklistReport,
    RolloutReadinessReport,
    ServiceManifest,
    ShadowComparisonInput,
    ShadowRecord,
)
from .policies import evaluate_job_policy, policy_manifest
from .release import build_evidence_bundle, build_release_checklist
from .rollout import rollout_store
from .security import require_bridge_auth
from .services.job_router import JOB_ROUTES, build_acceptance
from .telemetry import configure_logging, configure_telemetry, safe_log

configure_logging()
settings = get_settings()

app = FastAPI(
    title="CarePoint Python Worker Service",
    version=__version__,
    description="Hybrid Python worker and canary service for CarePoint Option B.",
)
configure_telemetry(app)


@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    timer = Timer()
    response = await call_next(request)
    worker_metrics.increment(
        "carepoint_python_worker_http_requests_total",
        {"method": request.method, "path": request.url.path, "status": str(response.status_code)},
    )
    worker_metrics.observe_duration(
        "carepoint_python_worker_http_request",
        timer.elapsed,
        {"method": request.method, "path": request.url.path},
    )
    return response


@app.get("/livez")
async def livez() -> dict:
    return {"ok": True, "service": settings.service_name, "version": __version__, "mode": settings.node_env}


async def redis_health() -> DependencyHealth:
    if not settings.queue_enabled and not settings.job_status_redis_enabled:
        return DependencyHealth(ok=True, name="redis", status="skipped", detail="queue/status redis disabled")
    try:
        import redis.asyncio as redis

        client = redis.from_url(settings.redis_url, socket_connect_timeout=2, socket_timeout=2)
        try:
            pong = await client.ping()
        finally:
            await client.aclose()
        return DependencyHealth(ok=bool(pong), name="redis", status="ok")
    except Exception as exc:  # pragma: no cover - network dependent
        return DependencyHealth(ok=False, name="redis", status="error", detail=str(exc))


@app.get("/readyz")
async def readyz() -> dict:
    redis = await redis_health()
    return {
        "ok": redis.ok,
        "service": settings.service_name,
        "version": __version__,
        "dependencies": {"redis": model_dump(redis)},
    }


@app.get("/api/v1/manifest", dependencies=[Depends(require_bridge_auth)])
async def manifest() -> ServiceManifest:
    return ServiceManifest(
        service=settings.service_name,
        version=__version__,
        mode=settings.node_env,
        queueEnabled=settings.queue_enabled,
        capabilities=[
            "job-envelope-validation",
            "shadow-traffic-recording",
            "canary-ready-routing",
            "celery-worker-dispatch",
            "idempotent-job-registry",
            "redis-backed-job-status-optional",
            "admin-audit-export-preparation",
            "admin-audit-export-artifacts",
            "sanitized-local-artifact-registry",
            "accounts-bulk-validation",
            "analytics-snapshot-computation",
            "notification-dispatch-planning",
            "ai-triage-preview-non-diagnostic",
            "hmac-signed-node-bridge",
            "hmac-signed-bridge-requests",
            "job-policy-gating",
            "payload-data-minimization-guard",
            "prometheus-metrics",
            "prometheus-compatible-metrics",
            "shadow-result-comparison",
            "canary-gate-decision",
            "artifact-retention-gc",
            "contract-manifest-v26",
            "contract-test-vectors",
            "contract-envelope-validation",
            "rollout-readiness-report",
            "canary-rollout-controller",
            "deterministic-canary-assignment",
            "rollout-audit-ledger",
            "route-scoped-rollout-actions",
            "release-checklist-report",
            "rollout-evidence-bundle",
            "admin-accounts-read-model-preparation",
            "provider-role-reconciliation-advisory",
            "scheduling-availability-snapshot",
            "messaging-reminder-plan-dry-run",
            "billing-payment-reconciliation-advisory",
            "clinical-records-access-audit-indicators",
            "platform-db-index-advisory",
            "platform-slo-regression-report",
            "platform-contract-replay-release-gate",
            "platform-privacy-preflight",
            "platform-release-decision-gate",
            "platform-rollback-drill-runbook",
            "platform-post-deploy-verification",
            "platform-change-ticket-evidence-bundle",
            "platform-operational-handoff-pack",
            "platform-incident-simulation-drill",
            "platform-capacity-plan-advisory",
            "platform-alert-policy-review",
            "platform-dependency-readiness-gate",
            "platform-production-readiness-gate",
            "platform-data-retention-review-gate",
            "platform-audit-trail-review-gate",
            "platform-security-posture-review-gate",
            "platform-supply-chain-review-gate",
            "platform-schema-migration-rehearsal-gate",
            "platform-backup-restore-drill-gate",
            "platform-observability-coverage-review-gate",
            "platform-feature-flag-review-gate",
            "platform-domain-migration-readiness-gate",
            "platform-cutover-plan-advisory",
            "platform-owner-registry-review-gate",
            "platform-post-cutover-monitor-gate",
            "platform-legacy-path-decommission-readiness",
            "platform-steady-state-operations-review",
            "platform-queue-resilience-review",
            "platform-artifact-integrity-review",
            "platform-runbook-freshness-review",
            "platform-support-escalation-review",
            "platform-cost-guardrail-review",
            "platform-environment-parity-review",
            "platform-access-control-review",
            "platform-data-quality-review",
            "platform-production-canary-observation-review",
            "platform-incident-response-readiness-review",
            "platform-traffic-promotion-readiness-review",
            "platform-evidence-retention-audit-review",
            "platform-slo-error-budget-review",
            "platform-auto-rollback-safeguard-review",
            "platform-third-party-dependency-review",
            "platform-capacity-scaling-readiness-review",
            "platform-compliance-privacy-evidence-review",
            "platform-runbook-drill-verification-review",
            "platform-disaster-recovery-backup-review",
            "platform-change-migration-readiness-review",
            "platform-configuration-secret-rotation-review",
            "platform-maintenance-window-readiness-review",
            "platform-audit-forensics-readiness-review",
            "platform-business-continuity-readiness-review",
            "platform-post-incident-learning-review",
            "platform-tech-debt-governance-review",
            "platform-vendor-resilience-review",
            "platform-knowledge-transfer-readiness-review",
            "platform-architecture-ownership-review",
            "platform-executive-metrics-governance-review",
            "platform-domain-adoption-readiness-review",
            "platform-phase-two-rollout-governance-review",
            "platform-domain-pilot-execution-review",
            "platform-phase-two-expansion-control-review",
            "platform-domain-outcome-measurement-review",
            "platform-phase-two-feedback-adoption-review",
            "platform-domain-graduation-readiness-review",
            "platform-phase-two-learning-consolidation-review",
            "platform-domain-wide-adoption-readiness-review",
            "platform-phase-two-support-transition-review",
            "platform-domain-adoption-stabilization-review",
            "platform-phase-two-value-realization-review",
            "platform-phase-two-closure-acceptance-review",
            "platform-phase-three-transition-readiness-review",
            "platform-phase-three-domain-wave-readiness-review",
            "platform-phase-three-operating-model-alignment-review",
            "platform-stage-closure-certification-review",
            "platform-post-closure-operational-transition-review",
            "platform-post-closure-monitoring-review",
            "platform-steady-state-transfer-validation-review",
            "platform-final-closure-evidence-package-review",
            "platform-global-implementation-completion-checklist-review",
            "node-control-plane-assignment-ready",
        ],
        jobTypes=[item.value for item in JobType],
        security={
            "sharedSecretRequired": settings.secret_is_required,
            "signatureRequired": settings.signature_is_required,
            "signatureToleranceSeconds": settings.signature_tolerance_seconds,
            "legacySecretHeaderAccepted": settings.allow_legacy_secret_header and not settings.signature_is_required,
        },
        metrics={"enabled": settings.metrics_enabled, "endpoint": "/metrics", "summaryEndpoint": "/api/v1/jobs/summary"},
        storage={
            "statusBackend": settings.status_backend,
            "artifactRoot": str(settings.artifact_root_path),
            "artifactTtlSeconds": settings.artifact_ttl_seconds,
        },
    )


@app.get("/api/v1/policies/manifest", dependencies=[Depends(require_bridge_auth)])
async def policies_manifest() -> dict:
    return {"jobPolicies": policy_manifest()}


@app.get("/api/v1/contracts/manifest", response_model=ContractManifest, dependencies=[Depends(require_bridge_auth)])
async def contracts_manifest() -> ContractManifest:
    return build_contract_manifest(settings.service_name)


@app.get("/api/v1/contracts/test-vectors", response_model=list[ContractTestVector], dependencies=[Depends(require_bridge_auth)])
async def contract_test_vectors() -> list[ContractTestVector]:
    return build_contract_test_vectors()


@app.post("/api/v1/contracts/validate", response_model=ContractValidationReport, dependencies=[Depends(require_bridge_auth)])
async def validate_contract(job: JobEnvelope) -> ContractValidationReport:
    return validate_contract_envelope(job)


def _enforce_job_policy(job: JobEnvelope) -> list[str]:
    decision = evaluate_job_policy(job)
    if not decision.allowed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "Python job blocked by Option B data policy",
                "dataClassification": decision.data_classification,
                "blockedPaths": list(decision.blocked_paths),
                "warnings": list(decision.warnings),
            },
        )
    return list(decision.warnings)


@app.post("/api/v1/jobs/enqueue", response_model=JobAccepted, dependencies=[Depends(require_bridge_auth)])
async def enqueue_job(job: JobEnvelope) -> JobAccepted:
    existing = job_store.get(job.idempotency_key)
    if existing is not None:
        safe_log(
            "job_duplicate_replayed",
            job_type=job.job_type.value,
            idempotency_key=job.idempotency_key,
            status=existing.status.value,
        )
        return build_acceptance(
            job,
            queued=existing.queued,
            task_id=existing.task_id,
            status=existing.status,
            duplicate=True,
            result=existing.result,
        )

    if not job.dry_run and not settings.queue_enabled:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="PYTHON_WORKER_QUEUE_ENABLED must be true for non-dry-run jobs",
        )

    policy_warnings = _enforce_job_policy(job)

    if settings.queue_enabled:
        route = JOB_ROUTES[job.job_type]
        task = celery_app.send_task(route.celery_task_name, args=[model_dump(job, by_alias=True)])
        accepted = build_acceptance(job, queued=True, task_id=task.id, status=JobStatus.QUEUED)
        job_store.accept(job, accepted, JobStatus.QUEUED)
        worker_metrics.increment("carepoint_python_worker_job_events_total", {"job_type": job.job_type.value, "status": "queued"})
        safe_log("job_enqueued", job_type=job.job_type.value, idempotency_key=job.idempotency_key, task_id=task.id)
        return accepted

    accepted = build_acceptance(job, queued=False, status=JobStatus.ACCEPTED)
    job_store.accept(job, accepted, JobStatus.ACCEPTED)
    job_store.mark_running(job, queued=False)
    worker_metrics.increment("carepoint_python_worker_job_events_total", {"job_type": job.job_type.value, "status": "running"})
    try:
        result = process_job(job)
        if policy_warnings:
            result.warnings = [*policy_warnings, *result.warnings]
    except Exception as exc:
        job_store.fail(job, str(exc))
        worker_metrics.increment("carepoint_python_worker_job_events_total", {"job_type": job.job_type.value, "status": "failed"})
        safe_log("job_inline_failed", job_type=job.job_type.value, idempotency_key=job.idempotency_key, error=str(exc))
        raise

    job_store.succeed(job, result)
    worker_metrics.increment("carepoint_python_worker_job_events_total", {"job_type": job.job_type.value, "status": "succeeded"})
    safe_log("job_inline_succeeded", job_type=job.job_type.value, idempotency_key=job.idempotency_key, queued=False)
    return build_acceptance(job, queued=False, status=JobStatus.SUCCEEDED, result=result)


@app.get("/api/v1/jobs/summary", dependencies=[Depends(require_bridge_auth)])
async def get_jobs_summary() -> dict[str, object]:
    return job_store.summary()


@app.get("/api/v1/jobs/metrics", dependencies=[Depends(require_bridge_auth)])
async def job_metrics(limit: int = Query(default=20, ge=1, le=100)) -> dict[str, object]:
    summary = job_store.summary()
    records = [model_dump(record, by_alias=True, mode="json") for record in job_store.list_recent(limit=limit)]
    return {**summary, "recentJobs": records, "serviceMetrics": worker_metrics.snapshot()}


@app.get("/api/v1/jobs", response_model=list[JobRecord], dependencies=[Depends(require_bridge_auth)])
async def list_jobs(
    limit: int = Query(default=50, ge=1, le=200),
    status_filter: JobStatus | None = Query(default=None, alias="status"),
) -> list[JobRecord]:
    return job_store.list_recent(limit=limit, status=status_filter)


@app.get("/api/v1/jobs/status/{lookup}", response_model=JobRecord, dependencies=[Depends(require_bridge_auth)])
async def get_job_status(lookup: str) -> JobRecord:
    return await get_job(lookup)


@app.get("/api/v1/jobs/{lookup}", response_model=JobRecord, dependencies=[Depends(require_bridge_auth)])
async def get_job(lookup: str) -> JobRecord:
    record = job_store.get(lookup)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="job not found")
    return record


@app.post("/api/v1/jobs/{lookup}/cancel", response_model=JobRecord, dependencies=[Depends(require_bridge_auth)])
async def cancel_job(lookup: str, payload: dict[str, str] | None = None) -> JobRecord:
    reason = (payload or {}).get("reason") or "operator-request"
    record = job_store.cancel(lookup, reason)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="job not found")
    return record


@app.post("/api/v1/shadow/jobs/record", dependencies=[Depends(require_bridge_auth)])
async def record_shadow_job(record: ShadowRecord) -> dict:
    item = shadow_store.add(record)
    worker_metrics.increment("carepoint_python_worker_shadow_events_total", {"route": record.route, "method": record.method})
    safe_log("shadow_job_recorded", route=record.route, method=record.method, correlation_id=record.correlation_id)
    return {"accepted": True, "mode": "shadow", "service": settings.service_name, "record": item}


@app.get("/api/v1/shadow/jobs", dependencies=[Depends(require_bridge_auth)])
async def shadow_jobs(limit: int = Query(default=20, ge=1, le=100)) -> dict:
    records = shadow_store.list_recent(limit=limit)
    return {**shadow_store.summary(), "records": records, "items": records, "count": len(records)}


@app.get("/api/v1/shadow/summary", dependencies=[Depends(require_bridge_auth)])
async def shadow_summary() -> dict:
    return shadow_store.summary()


@app.post("/api/v1/shadow/comparisons/record", dependencies=[Depends(require_bridge_auth)])
async def record_shadow_comparison(record: ShadowComparisonInput) -> dict:
    try:
        item = shadow_comparison_store.compare(record)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    worker_metrics.increment("carepoint_python_worker_shadow_comparisons_total", {"outcome": item["outcome"]})
    return {"accepted": True, "record": item, "summary": shadow_comparison_store.summary()}


@app.get("/api/v1/shadow/comparisons", dependencies=[Depends(require_bridge_auth)])
async def shadow_comparisons(
    limit: int = Query(default=20, ge=1, le=100),
    outcome: str | None = Query(default=None),
) -> dict:
    items = shadow_comparison_store.list_recent(limit=limit, outcome=outcome)
    return {**shadow_comparison_store.summary(), "records": items, "count": len(items)}


@app.get("/api/v1/canary/gate", response_model=CanaryGateDecision, dependencies=[Depends(require_bridge_auth)])
async def canary_gate(
    max_mismatch_rate: float = Query(default=0.05, ge=0, le=1, alias="maxMismatchRate"),
    max_failed_jobs: int = Query(default=0, ge=0, le=1000, alias="maxFailedJobs"),
    min_comparisons: int = Query(default=10, ge=0, le=10000, alias="minComparisons"),
) -> CanaryGateDecision:
    return evaluate_canary_gate(
        job_summary=job_store.summary(),
        comparison_summary=shadow_comparison_store.summary(),
        max_mismatch_rate=max_mismatch_rate,
        max_failed_jobs=max_failed_jobs,
        min_comparisons=min_comparisons,
    )


@app.get("/api/v1/rollout/readiness", response_model=RolloutReadinessReport, dependencies=[Depends(require_bridge_auth)])
async def rollout_readiness(
    current_canary_percent: int = Query(default=0, ge=0, le=100, alias="currentCanaryPercent"),
    target_canary_percent: int = Query(default=5, ge=0, le=100, alias="targetCanaryPercent"),
    job_type: JobType | None = Query(default=None, alias="jobType"),
    max_mismatch_rate: float = Query(default=0.05, ge=0, le=1, alias="maxMismatchRate"),
    max_failed_jobs: int = Query(default=0, ge=0, le=1000, alias="maxFailedJobs"),
    min_comparisons: int = Query(default=10, ge=0, le=10000, alias="minComparisons"),
) -> RolloutReadinessReport:
    gate = evaluate_canary_gate(
        job_summary=job_store.summary(),
        comparison_summary=shadow_comparison_store.summary(),
        max_mismatch_rate=max_mismatch_rate,
        max_failed_jobs=max_failed_jobs,
        min_comparisons=min_comparisons,
    )
    return build_rollout_readiness_report(
        gate=gate,
        current_canary_percent=current_canary_percent,
        target_canary_percent=target_canary_percent,
        job_type=job_type,
        signature_required=settings.signature_is_required,
    )


@app.get("/api/v1/canary/rollout", response_model=CanaryRolloutState, dependencies=[Depends(require_bridge_auth)])
async def canary_rollout(route: str = Query(default="/api/hybrid-python/jobs")) -> CanaryRolloutState:
    return rollout_store.current(route)


@app.post("/api/v1/canary/rollout/plan", response_model=CanaryRolloutState, dependencies=[Depends(require_bridge_auth)])
async def plan_canary_rollout(plan: CanaryRolloutPlanRequest) -> CanaryRolloutState:
    return rollout_store.plan(plan)


@app.post("/api/v1/canary/rollout/advance", response_model=CanaryRolloutState, dependencies=[Depends(require_bridge_auth)])
async def advance_canary_rollout(action: CanaryRolloutAction) -> CanaryRolloutState:
    state = rollout_store.current(action.route)
    gate = evaluate_canary_gate(
        job_summary=job_store.summary(),
        comparison_summary=shadow_comparison_store.summary(),
        max_mismatch_rate=state.max_mismatch_rate,
        max_failed_jobs=state.max_failed_jobs,
        min_comparisons=state.min_comparisons,
    )
    return rollout_store.advance(action, gate, route=action.route)


@app.post("/api/v1/canary/rollout/pause", response_model=CanaryRolloutState, dependencies=[Depends(require_bridge_auth)])
async def pause_canary_rollout(action: CanaryRolloutAction) -> CanaryRolloutState:
    return rollout_store.pause(action, route=action.route)


@app.post("/api/v1/canary/rollout/resume", response_model=CanaryRolloutState, dependencies=[Depends(require_bridge_auth)])
async def resume_canary_rollout(action: CanaryRolloutAction) -> CanaryRolloutState:
    return rollout_store.resume(action, route=action.route)


@app.post("/api/v1/canary/rollout/rollback", response_model=CanaryRolloutState, dependencies=[Depends(require_bridge_auth)])
async def rollback_canary_rollout(action: CanaryRolloutAction) -> CanaryRolloutState:
    return rollout_store.rollback(action, route=action.route)


@app.post("/api/v1/canary/assignment", response_model=CanaryAssignment, dependencies=[Depends(require_bridge_auth)])
async def canary_assignment(request: CanaryAssignmentRequest) -> CanaryAssignment:
    return rollout_store.assign(request)


@app.get("/api/v1/canary/rollout/audit", dependencies=[Depends(require_bridge_auth)])
async def canary_rollout_audit(limit: int = Query(default=50, ge=1, le=200)) -> dict:
    return rollout_store.audit(limit=limit)


@app.get("/api/v1/release/checklist", response_model=ReleaseChecklistReport, dependencies=[Depends(require_bridge_auth)])
async def release_checklist() -> ReleaseChecklistReport:
    redis = await redis_health()
    return build_release_checklist(redis=redis)


@app.get("/api/v1/evidence/bundle", response_model=EvidenceBundle, dependencies=[Depends(require_bridge_auth)])
async def evidence_bundle() -> EvidenceBundle:
    redis = await redis_health()
    return build_evidence_bundle(redis=redis)


@app.get("/api/v1/artifacts/{artifact_id}", dependencies=[Depends(require_bridge_auth)])
async def artifact_metadata(artifact_id: str) -> dict:
    ref = artifact_store.get(artifact_id)
    if ref is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="artifact not found")
    return model_dump(ref, by_alias=True, mode="json")


@app.get("/api/v1/artifacts/{artifact_id}/download", dependencies=[Depends(require_bridge_auth)])
async def artifact_download(artifact_id: str):
    ref = artifact_store.get(artifact_id)
    if ref is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="artifact not found")
    path = Path(ref.path)
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="artifact payload not found")
    return FileResponse(path=path, filename=ref.filename, media_type=ref.content_type)


@app.post("/api/v1/artifacts/gc", dependencies=[Depends(require_bridge_auth)])
async def artifact_gc(dry_run: bool = Query(default=True, alias="dryRun")) -> dict:
    return artifact_store.cleanup_expired(dry_run=dry_run)


@app.get("/api/v1/metrics/snapshot", dependencies=[Depends(require_bridge_auth)])
async def metrics_snapshot() -> dict:
    return worker_metrics.snapshot()


@app.get("/metrics")
async def prometheus_metrics() -> Response:
    return PlainTextResponse(worker_metrics.render_prometheus(), media_type="text/plain; version=0.0.4")


# Backward-compatible function aliases used by local contract tests and lightweight smoke checks.
async def jobs_summary() -> dict[str, object]:
    return await get_jobs_summary()


async def policies() -> dict:
    return await policies_manifest()


async def recent_shadow_jobs(limit: int = 20) -> dict:
    return await shadow_jobs(limit=limit)


async def get_artifact_metadata(artifact_id: str) -> dict:
    return await artifact_metadata(artifact_id)

# Compatibility aliases used by direct contract tests and early V3 draft names.
async def policies() -> dict:
    return await policies_manifest()


async def metrics_snapshot() -> dict:
    return worker_metrics.snapshot()


async def jobs_summary() -> dict[str, object]:
    return await get_jobs_summary()


async def recent_shadow_jobs(limit: int = 20) -> dict:
    items = shadow_store.list_recent(limit=limit)
    return {**shadow_store.summary(), "records": items, "count": len(items)}


async def get_artifact_metadata(artifact_id: str) -> dict:
    return await artifact_metadata(artifact_id)


# V4 compatibility aliases for direct tests and lightweight smoke checks.
async def record_shadow_comparison_direct(record: ShadowComparisonInput) -> dict:
    return await record_shadow_comparison(record)


async def recent_shadow_comparisons(limit: int = 20, outcome: str | None = None) -> dict:
    return await shadow_comparisons(limit=limit, outcome=outcome)


async def canary_gate_decision(maxMismatchRate: float = 0.05, maxFailedJobs: int = 0, minComparisons: int = 10) -> CanaryGateDecision:
    return await canary_gate(maxMismatchRate, maxFailedJobs, minComparisons)


async def artifact_gc_direct(dryRun: bool = True) -> dict:
    return await artifact_gc(dry_run=dryRun)


# V5 compatibility aliases for contract/readiness tests and smoke checks.
async def contracts_manifest_direct() -> ContractManifest:
    return await contracts_manifest()


async def contract_test_vectors_direct() -> list[ContractTestVector]:
    return await contract_test_vectors()


async def validate_contract_direct(job: JobEnvelope) -> ContractValidationReport:
    return await validate_contract(job)


async def rollout_readiness_direct(
    currentCanaryPercent: int = 0,
    targetCanaryPercent: int = 5,
    jobType: JobType | None = None,
    maxMismatchRate: float = 0.05,
    maxFailedJobs: int = 0,
    minComparisons: int = 10,
) -> RolloutReadinessReport:
    return await rollout_readiness(currentCanaryPercent, targetCanaryPercent, jobType, maxMismatchRate, maxFailedJobs, minComparisons)


# V5 rollout controller aliases for direct tests and staged smoke checks.
async def get_canary_rollout_direct(route: str = "/api/hybrid-python/jobs") -> CanaryRolloutState:
    return await canary_rollout(route=route)


async def plan_canary_rollout_direct(plan: CanaryRolloutPlanRequest) -> CanaryRolloutState:
    return await plan_canary_rollout(plan)


async def advance_canary_rollout_direct(action: CanaryRolloutAction) -> CanaryRolloutState:
    return await advance_canary_rollout(action)


async def pause_canary_rollout_direct(action: CanaryRolloutAction) -> CanaryRolloutState:
    return await pause_canary_rollout(action)


async def resume_canary_rollout_direct(action: CanaryRolloutAction) -> CanaryRolloutState:
    return await resume_canary_rollout(action)


async def rollback_canary_rollout_direct(action: CanaryRolloutAction) -> CanaryRolloutState:
    return await rollback_canary_rollout(action)


async def canary_assignment_direct(request: CanaryAssignmentRequest) -> CanaryAssignment:
    return await canary_assignment(request)


# V6 release/evidence aliases for direct tests and deployment smoke checks.
async def release_checklist_direct() -> ReleaseChecklistReport:
    redis = await redis_health()
    return build_release_checklist(redis=redis)


async def evidence_bundle_direct() -> EvidenceBundle:
    redis = await redis_health()
    return build_evidence_bundle(redis=redis)


# V10 compatibility aliases for direct tests and release-gate smoke checks.
async def contract_replay_vectors_direct(job: JobEnvelope) -> JobAccepted:
    return await enqueue_job(job)


async def privacy_preflight_direct(job: JobEnvelope) -> JobAccepted:
    return await enqueue_job(job)
