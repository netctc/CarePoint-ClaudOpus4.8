from __future__ import annotations

import csv
import hashlib
import json
import shutil
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from .compat import model_dump, model_validate
from .config import get_settings
from .models import ArtifactRef

SENSITIVE_FIELD_FRAGMENTS = (
    "email",
    "phone",
    "ssn",
    "token",
    "secret",
    "password",
    "dob",
    "birth",
    "diagnosis",
    "note",
    "phi",
)


def utc_now_iso() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _safe_name(value: str) -> str:
    chars: list[str] = []
    for char in value.lower():
        chars.append(char if char.isalnum() or char in ("-", "_", ".") else "-")
    return "".join(chars).strip(".-_") or "artifact"


def _json_bytes(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, ensure_ascii=False, indent=2, default=str).encode("utf-8")


def _sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def redact_record(record: dict[str, Any], allowed_columns: list[str] | None = None) -> dict[str, Any]:
    columns = allowed_columns or sorted(record.keys())
    redacted: dict[str, Any] = {}
    for key in columns:
        value = record.get(key)
        lowered = key.lower()
        if any(fragment in lowered for fragment in SENSITIVE_FIELD_FRAGMENTS):
            redacted[key] = "[REDACTED]" if value not in (None, "") else value
        else:
            redacted[key] = value
    return redacted


class LocalArtifactStore:
    def __init__(self) -> None:
        settings = get_settings()
        self.root = settings.artifact_root_path
        self.metadata_root = self.root / ".metadata"
        self.root.mkdir(parents=True, exist_ok=True)
        self.metadata_root.mkdir(parents=True, exist_ok=True)

    def reset_for_tests(self) -> None:
        if self.root.exists():
            for child in self.root.iterdir():
                if child.is_dir():
                    shutil.rmtree(child)
                else:
                    child.unlink()
        self.root.mkdir(parents=True, exist_ok=True)
        self.metadata_root.mkdir(parents=True, exist_ok=True)

    def path_for(self, artifact_id: str) -> Path:
        return self.root / f"{artifact_id}.bin"

    def _metadata_path(self, artifact_id: str) -> Path:
        return self.metadata_root / f"{artifact_id}.json"

    def _artifact_id(self, prefix: str, payload: bytes) -> str:
        digest = _sha256_bytes(prefix.encode("utf-8") + b"\n" + payload)[:24]
        return f"art_{_safe_name(prefix)[:40]}_{digest}"

    def _build_ref(
        self,
        *,
        artifact_id: str,
        artifact_type: str,
        filename: str,
        content_type: str,
        payload: bytes,
        metadata: dict[str, Any],
    ) -> ArtifactRef:
        settings = get_settings()
        created_at = utc_now_iso()
        expires_at = (datetime.now(UTC) + timedelta(seconds=settings.artifact_ttl_seconds)).isoformat().replace(
            "+00:00", "Z"
        )
        download_url = f"/api/v1/artifacts/{artifact_id}/download"
        if settings.artifact_public_base_url:
            download_url = settings.artifact_public_base_url.rstrip("/") + download_url
        return ArtifactRef(
            artifactId=artifact_id,
            artifactType=artifact_type,
            contentType=content_type,
            filename=filename,
            sizeBytes=len(payload),
            sha256=_sha256_bytes(payload),
            createdAt=created_at,
            expiresAt=expires_at,
            downloadUrl=download_url,
            path=str(self.path_for(artifact_id)),
            redactionApplied=bool(metadata.get("redactionApplied", True)),
            piiClass=str(metadata.get("piiClass", "minimized-operational")),
            metadata=metadata,
        )

    def _write(
        self,
        *,
        prefix: str,
        suffix: str,
        artifact_type: str,
        content_type: str,
        payload: bytes,
        metadata: dict[str, Any],
    ) -> ArtifactRef:
        artifact_id = self._artifact_id(prefix, payload)
        filename = f"{_safe_name(prefix)}.{suffix.lstrip('.')}"
        ref = self._build_ref(
            artifact_id=artifact_id,
            artifact_type=artifact_type,
            filename=filename,
            content_type=content_type,
            payload=payload,
            metadata=metadata,
        )
        path = self.path_for(artifact_id)
        path.write_bytes(payload)
        self._metadata_path(artifact_id).write_bytes(_json_bytes(model_dump(ref, by_alias=True, mode="json")))
        return ref

    def write_json(self, *, prefix: str, artifact_type: str, payload: Any, metadata: dict[str, Any]) -> ArtifactRef:
        return self._write(
            prefix=prefix,
            suffix="json",
            artifact_type=artifact_type,
            content_type="application/json",
            payload=_json_bytes(payload),
            metadata=metadata,
        )

    def write_csv(
        self,
        *,
        prefix: str,
        artifact_type: str,
        rows: list[dict[str, Any]],
        columns: list[str],
        metadata: dict[str, Any],
    ) -> ArtifactRef:
        import io

        buffer = io.StringIO()
        writer = csv.DictWriter(buffer, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow({column: row.get(column) for column in columns})
        return self._write(
            prefix=prefix,
            suffix="csv",
            artifact_type=artifact_type,
            content_type="text/csv",
            payload=buffer.getvalue().encode("utf-8"),
            metadata=metadata,
        )

    def cleanup_expired(self, *, dry_run: bool = True) -> dict[str, Any]:
        now = datetime.now(UTC)
        scanned = 0
        expired: list[str] = []
        removed = 0
        for metadata_path in sorted(self.metadata_root.glob("*.json")):
            scanned += 1
            try:
                ref = model_validate(ArtifactRef, json.loads(metadata_path.read_text(encoding="utf-8")))
                expires_at_raw = ref.expires_at
                if not expires_at_raw:
                    continue
                expires_at = datetime.fromisoformat(expires_at_raw.replace("Z", "+00:00"))
                if expires_at > now:
                    continue
                expired.append(ref.artifact_id)
                if not dry_run:
                    payload_path = Path(ref.path)
                    if payload_path.exists() and payload_path.is_file():
                        payload_path.unlink()
                    metadata_path.unlink(missing_ok=True)
                    removed += 1
            except Exception:
                continue
        return {
            "dryRun": dry_run,
            "scanned": scanned,
            "expired": len(expired),
            "removed": removed,
            "artifactIds": expired[:100],
            "truncated": max(0, len(expired) - 100),
        }

    def get(self, artifact_id: str) -> ArtifactRef | None:
        metadata_path = self._metadata_path(artifact_id)
        if not metadata_path.exists():
            return None
        return model_validate(ArtifactRef, json.loads(metadata_path.read_text(encoding="utf-8")))


artifact_store = LocalArtifactStore()
