from __future__ import annotations

import csv
import hashlib
import json
import re
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from ..config import get_settings
from ..models import ArtifactRef, JobEnvelope

SAFE_NAME_RE = re.compile(r"[^a-zA-Z0-9._-]+")


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _safe_name(name: str) -> str:
    cleaned = SAFE_NAME_RE.sub("-", name.strip()).strip(".-")
    return cleaned[:160] or "artifact"


def _artifact_dir(job: JobEnvelope) -> Path:
    now = _utc_now()
    base = get_settings().artifact_root_path
    path = base / now.strftime("%Y") / now.strftime("%m") / now.strftime("%d") / _safe_name(job.idempotency_key)
    path.mkdir(parents=True, exist_ok=True)
    return path


def _artifact_ref(job: JobEnvelope, path: Path, content_type: str) -> ArtifactRef:
    settings = get_settings()
    content = path.read_bytes()
    digest = hashlib.sha256(content).hexdigest()
    artifact_seed = f"{job.idempotency_key}:{path.name}:{digest}"
    artifact_id = hashlib.sha256(artifact_seed.encode("utf-8")).hexdigest()[:32]
    expires_at = (_utc_now() + timedelta(seconds=settings.artifact_ttl_seconds)).isoformat().replace("+00:00", "Z")
    return ArtifactRef(
        artifactId=artifact_id,
        name=path.name,
        contentType=content_type,
        sizeBytes=len(content),
        sha256=digest,
        storagePath=str(path),
        expiresAt=expires_at,
    )


def write_json_artifact(job: JobEnvelope, name: str, payload: dict[str, Any]) -> ArtifactRef:
    artifact_path = _artifact_dir(job) / _safe_name(name)
    if artifact_path.suffix.lower() != ".json":
        artifact_path = artifact_path.with_suffix(".json")
    artifact_path.write_text(json.dumps(payload, sort_keys=True, indent=2, default=str) + "\n", encoding="utf-8")
    return _artifact_ref(job, artifact_path, "application/json")


def write_csv_artifact(job: JobEnvelope, name: str, rows: list[dict[str, Any]], columns: list[str]) -> ArtifactRef:
    artifact_path = _artifact_dir(job) / _safe_name(name)
    if artifact_path.suffix.lower() != ".csv":
        artifact_path = artifact_path.with_suffix(".csv")
    with artifact_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow({column: row.get(column, "") for column in columns})
    return _artifact_ref(job, artifact_path, "text/csv")
