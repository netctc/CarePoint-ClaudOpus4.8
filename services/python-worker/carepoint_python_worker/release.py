from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from . import __version__
from .artifacts import artifact_store
from .canary import evaluate_canary_gate
from .compat import model_dump
from .config import get_settings
from .contracts import SCHEMA_VERSION, build_contract_manifest
from .jobs.shadow_compare_store import shadow_comparison_store
from .jobs.shadow_store import shadow_store
from .jobs.store import job_store
from .metrics import metrics as worker_metrics
from .models import DependencyHealth, EvidenceBundle, ReleaseChecklistItem, ReleaseChecklistReport
from .policies import policy_manifest
from .rollout import DEFAULT_ROUTE, rollout_store


def utc_now_iso() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def status_rank(status: str) -> int:
    return {"pass": 0, "warn": 1, "fail": 2}.get(status, 1)


def build_item(check_id: str, label: str, status: str, required: bool, detail: str, remediation: str = "") -> ReleaseChecklistItem:
    return ReleaseChecklistItem(checkId=check_id, label=label, status=status, required=required, detail=detail, remediation=remediation)


def artifact_summary() -> dict[str, Any]:
    by_type: dict[str, int] = {}
    expired = 0
    total = 0
    now = utc_now_iso()
    for metadata_path in sorted(artifact_store.metadata_root.glob("*.json"))[:1000]:
        try:
            ref = artifact_store.get(metadata_path.stem)
        except Exception:
            ref = None
        if ref is None:
            continue
        total += 1
        by_type[ref.artifact_type] = by_type.get(ref.artifact_type, 0) + 1
        if ref.expires_at and ref.expires_at < now:
            expired += 1
    return {"totalArtifacts": total, "byType": by_type, "expiredArtifacts": expired}


def build_release_checklist(*, redis: DependencyHealth) -> ReleaseChecklistReport:
    settings = get_settings()
    manifest = build_contract_manifest(settings.service_name)
    rollout = rollout_store.current(DEFAULT_ROUTE)
    gate = evaluate_canary_gate(
        job_summary=job_store.summary(),
        comparison_summary=shadow_comparison_store.summary(),
        max_mismatch_rate=rollout.max_mismatch_rate,
        max_failed_jobs=rollout.max_failed_jobs,
        min_comparisons=0,
    )
    checks = [
        build_item(
            "bridge-signature",
            "Node to Python bridge is HMAC-signature capable",
            "pass" if settings.signature_is_required else "warn",
            True,
            "PYTHON_WORKER_REQUIRE_SIGNATURE is enabled." if settings.signature_is_required else "Signature requirement is not enabled for this environment.",
            "Set PYTHON_WORKER_REQUIRE_SIGNATURE=true and PYTHON_SERVICES_USE_HMAC_SIGNATURE=true before production canary.",
        ),
        build_item(
            "contracts-manifest",
            "Executable contract manifest is available",
            "pass" if manifest.contracts else "fail",
            True,
            f"{len(manifest.contracts)} contract capabilities loaded with hash {manifest.contract_hash}.",
            "Regenerate contract manifest and ensure all pilot job types are present.",
        ),
        build_item(
            "redis-readiness",
            "Redis readiness is acceptable for configured mode",
            "pass" if redis.ok else "fail",
            settings.queue_enabled or settings.job_status_redis_enabled,
            f"Redis status: {redis.status}; detail: {redis.detail or 'none'}.",
            "Enable and validate Redis before queued non-dry-run jobs or shared job status.",
        ),
        build_item(
            "queue-mode",
            "Non-dry-run queue mode is explicit",
            "pass" if settings.queue_enabled else "warn",
            False,
            "Queue enabled; Celery workers can process async jobs." if settings.queue_enabled else "Queue disabled; Python executes dry-run/inline workloads only.",
            "Set PYTHON_WORKER_QUEUE_ENABLED=true and run python-worker-celery before production non-dry-run jobs.",
        ),
        build_item(
            "canary-gate",
            "Canary gate is not recommending rollback",
            "pass" if gate.recommendation in {"advance", "hold"} else "fail",
            True,
            f"Gate recommendation: {gate.recommendation}; reasons: {', '.join(gate.reasons)}.",
            "Hold or rollback the rollout, inspect failed jobs and shadow comparison mismatches.",
        ),
        build_item(
            "artifact-retention",
            "Artifact retention path is configured",
            "pass" if str(settings.artifact_root_path) else "fail",
            True,
            f"Artifact root: {settings.artifact_root_path}; TTL seconds: {settings.artifact_ttl_seconds}.",
            "Configure PYTHON_WORKER_ARTIFACT_STORAGE_DIR and run artifact GC on a schedule.",
        ),
        build_item(
            "data-policy",
            "Data minimization policy manifest is present",
            "pass" if policy_manifest() else "fail",
            True,
            "Job policy manifest loaded; PHI/secret/token guards are active.",
            "Keep policy gates blocking by default and add tests for new job types.",
        ),
    ]
    overall = max((item.status for item in checks if item.required), key=status_rank, default="pass")
    if overall == "pass" and any(item.status == "warn" for item in checks):
        overall = "warn"
    return ReleaseChecklistReport(
        generatedAt=utc_now_iso(),
        service=settings.service_name,
        version=__version__,
        schemaVersion=SCHEMA_VERSION,
        environment=settings.node_env,
        overallStatus=overall,
        summary={
            "requiredChecks": sum(1 for item in checks if item.required),
            "pass": sum(1 for item in checks if item.status == "pass"),
            "warn": sum(1 for item in checks if item.status == "warn"),
            "fail": sum(1 for item in checks if item.status == "fail"),
        },
        checks=checks,
    )


def build_evidence_bundle(*, redis: DependencyHealth) -> EvidenceBundle:
    settings = get_settings()
    manifest = build_contract_manifest(settings.service_name)
    rollout = rollout_store.current(DEFAULT_ROUTE)
    gate = evaluate_canary_gate(
        job_summary=job_store.summary(),
        comparison_summary=shadow_comparison_store.summary(),
        max_mismatch_rate=rollout.max_mismatch_rate,
        max_failed_jobs=rollout.max_failed_jobs,
        min_comparisons=0,
    )
    checklist = build_release_checklist(redis=redis)
    return EvidenceBundle(
        generatedAt=utc_now_iso(),
        service=settings.service_name,
        version=__version__,
        schemaVersion=SCHEMA_VERSION,
        contractHash=manifest.contract_hash,
        environment=settings.node_env,
        rollout=model_dump(rollout, by_alias=True, mode="json"),
        canaryGate=model_dump(gate, by_alias=True, mode="json"),
        jobSummary=job_store.summary(),
        shadowSummary=shadow_store.summary(),
        comparisonSummary=shadow_comparison_store.summary(),
        metricsSnapshot=worker_metrics.snapshot(),
        policySummary={"jobPolicies": policy_manifest()},
        artifactSummary=artifact_summary(),
        checklist=model_dump(checklist, by_alias=True, mode="json"),
    )
