from __future__ import annotations

import csv
import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
from typing import Any, Callable

from ..config import get_settings
from ..models import ArtifactRef, JobEnvelope, JobResult, JobType

SAFE_AUDIT_EXPORT_COLUMNS = [
    "id",
    "createdAt",
    "organization",
    "actorRole",
    "action",
    "resource",
    "resourceId",
    "details",
]
VALID_ROLES = {
    "SUPER_ADMIN",
    "COMPANY_ADMIN",
    "COMPANY_SUPPORT",
    "PROVIDER",
    "NURSE",
    "PHARMACIST",
    "LAB_TECH",
    "FINANCE",
    "PATIENT",
}
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@dataclass(frozen=True)
class HandlerContext:
    artifact_dir: Path


def _utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ensure_artifact_dir() -> Path:
    settings = get_settings()
    artifact_dir = Path(settings.artifact_dir)
    artifact_dir.mkdir(parents=True, exist_ok=True)
    return artifact_dir


def _safe_filename(prefix: str, idempotency_key: str, suffix: str) -> str:
    digest = sha256(idempotency_key.encode("utf-8")).hexdigest()[:16]
    return f"{prefix}-{digest}.{suffix}"


def _write_text_artifact(job: JobEnvelope, prefix: str, suffix: str, body: str, content_type: str) -> ArtifactRef:
    artifact_dir = _ensure_artifact_dir()
    filename = _safe_filename(prefix, job.idempotency_key, suffix)
    path = artifact_dir / filename
    path.write_text(body, encoding="utf-8")
    digest = sha256(body.encode("utf-8")).hexdigest()
    return ArtifactRef(
        filename=filename,
        contentType=content_type,
        sha256=digest,
        bytes=len(body.encode("utf-8")),
        localPath=str(path),
    )


def _normalize_rows(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    rows: list[dict[str, Any]] = []
    for item in value[:5000]:
        if isinstance(item, dict):
            rows.append(item)
    return rows


def handle_admin_audit_export(job: JobEnvelope) -> JobResult:
    """Prepare a minimized audit-export artifact.

    Python does not query CarePoint's operational database in this phase. Node remains DB owner.
    For canary/shadow pilots, Node can pass pre-minimized rows. Python writes the artifact,
    returns checksums, and keeps PII-heavy columns suppressed by default.
    """

    payload = job.payload or {}
    filters = payload.get("filters") if isinstance(payload.get("filters"), dict) else {}
    requested_columns = payload.get("columns") if isinstance(payload.get("columns"), list) else []
    approved_columns = [c for c in requested_columns if c in SAFE_AUDIT_EXPORT_COLUMNS]
    if not approved_columns:
        approved_columns = SAFE_AUDIT_EXPORT_COLUMNS

    rows = _normalize_rows(payload.get("rows"))
    suppressed_columns = sorted({str(c) for c in requested_columns if c not in SAFE_AUDIT_EXPORT_COLUMNS})

    if not rows:
        manifest = {
            "kind": "admin.audit_export.plan",
            "generatedAt": _utc_iso(),
            "dryRun": job.dry_run,
            "filters": filters,
            "approvedColumns": approved_columns,
            "suppressedColumns": suppressed_columns,
            "handoff": "Node remains database owner. Provide pre-minimized rows for artifact generation or approve a DB-read ADR.",
        }
        artifact = _write_text_artifact(
            job,
            "audit-export-plan",
            "json",
            json.dumps(manifest, indent=2, sort_keys=True),
            "application/json",
        )
        return JobResult(
            ok=True,
            summary={
                "mode": "plan-only",
                "rowCount": 0,
                "approvedColumns": approved_columns,
                "suppressedColumns": suppressed_columns,
                "filters": filters,
            },
            artifact=artifact,
            warnings=["No rows were supplied; Python generated a plan artifact instead of querying the database."],
        )

    output_rows: list[dict[str, Any]] = []
    for row in rows:
        output_rows.append({column: row.get(column, "") for column in approved_columns})

    from io import StringIO

    buffer = StringIO()
    writer = csv.DictWriter(buffer, fieldnames=approved_columns, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(output_rows)
    artifact = _write_text_artifact(job, "audit-export", "csv", buffer.getvalue(), "text/csv")
    return JobResult(
        ok=True,
        summary={
            "mode": "artifact-generated",
            "rowCount": len(output_rows),
            "approvedColumns": approved_columns,
            "suppressedColumns": suppressed_columns,
            "filters": filters,
        },
        artifact=artifact,
        warnings=[] if not suppressed_columns else ["One or more requested columns were suppressed by data-minimization policy."],
    )


def handle_accounts_bulk_validate(job: JobEnvelope) -> JobResult:
    payload = job.payload or {}
    rows = _normalize_rows(payload.get("rows"))
    errors: list[dict[str, Any]] = []
    valid_count = 0
    for index, row in enumerate(rows):
        row_errors: list[str] = []
        email = str(row.get("email") or "").strip().lower()
        role = str(row.get("role") or "").strip().upper()
        if not EMAIL_RE.match(email):
            row_errors.append("email_invalid")
        if role and role not in VALID_ROLES:
            row_errors.append("role_invalid")
        if row_errors:
            errors.append({"row": index, "errors": row_errors})
        else:
            valid_count += 1

    return JobResult(
        ok=len(errors) == 0,
        summary={
            "rowCount": len(rows),
            "validCount": valid_count,
            "invalidCount": len(errors),
            "errorSample": errors[:50],
        },
        artifact=None,
        warnings=[] if rows else ["No rows supplied for validation."],
        errors=["bulk_validation_failed"] if errors else [],
    )


def handle_analytics_snapshot(job: JobEnvelope) -> JobResult:
    metrics = job.payload.get("metrics") if isinstance(job.payload.get("metrics"), dict) else {}
    numeric_values = [value for value in metrics.values() if isinstance(value, (int, float)) and not isinstance(value, bool)]
    summary = {
        "metricCount": len(metrics),
        "numericMetricCount": len(numeric_values),
        "numericTotal": sum(numeric_values) if numeric_values else 0,
        "generatedAt": _utc_iso(),
    }
    artifact = _write_text_artifact(
        job,
        "analytics-snapshot",
        "json",
        json.dumps({"summary": summary, "metricKeys": sorted(map(str, metrics.keys()))}, indent=2, sort_keys=True),
        "application/json",
    )
    return JobResult(ok=True, summary=summary, artifact=artifact)


def handle_notifications_dispatch(job: JobEnvelope) -> JobResult:
    payload = job.payload or {}
    recipients = payload.get("recipients") if isinstance(payload.get("recipients"), list) else []
    channel = str(payload.get("channel") or "unknown")
    if not job.dry_run:
        return JobResult(
            ok=False,
            summary={"recipientCount": len(recipients), "channel": channel},
            errors=["dispatch_provider_not_configured"],
            warnings=["Notification dispatch is contract-ready only; keep dryRun=true until provider ADR is approved."],
        )
    return JobResult(
        ok=True,
        summary={"recipientCount": len(recipients), "channel": channel, "dryRun": True},
        warnings=["Dry run only; no notifications were sent."],
    )


def handle_ai_triage_preview(job: JobEnvelope) -> JobResult:
    text = str(job.payload.get("text") or "").lower()
    tags: list[str] = []
    for keyword, tag in [("urgent", "contains-urgent-language"), ("pain", "mentions-pain"), ("refill", "mentions-refill"), ("appointment", "mentions-appointment")]:
        if keyword in text:
            tags.append(tag)
    return JobResult(
        ok=True,
        summary={
            "previewOnly": True,
            "tags": tags,
            "requiresHumanReview": True,
            "policy": "No diagnosis, acuity decision, or treatment recommendation is produced by this preview.",
        },
        warnings=["AI triage preview is not a clinical decision support system."],
    )


HANDLERS: dict[JobType, Callable[[JobEnvelope], JobResult]] = {
    JobType.ADMIN_AUDIT_EXPORT: handle_admin_audit_export,
    JobType.ADMIN_ACCOUNTS_BULK_VALIDATE: handle_accounts_bulk_validate,
    JobType.NOTIFICATIONS_DISPATCH: handle_notifications_dispatch,
    JobType.ANALYTICS_SNAPSHOT: handle_analytics_snapshot,
    JobType.AI_TRIAGE_PREVIEW: handle_ai_triage_preview,
}


def execute_job(job: JobEnvelope) -> JobResult:
    handler = HANDLERS[job.job_type]
    return handler(job)
