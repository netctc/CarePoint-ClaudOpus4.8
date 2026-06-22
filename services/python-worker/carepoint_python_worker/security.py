from __future__ import annotations

import hashlib
import hmac
import time

from fastapi import Header, HTTPException, Request, status

from .config import get_settings


def _normalize_signature(value: str | None) -> str:
    if not value:
        return ""
    cleaned = value.strip()
    if cleaned.startswith("sha256="):
        return cleaned.split("=", 1)[1]
    return cleaned


def _path_with_query(request: Request) -> str:
    query = request.url.query
    return f"{request.url.path}?{query}" if query else request.url.path


def build_bridge_signature(
    *,
    shared_secret: str,
    timestamp: str,
    method: str,
    path: str,
    body: bytes,
) -> str:
    """Build the canonical Node -> Python bridge HMAC signature."""

    body_hash = hashlib.sha256(body).hexdigest()
    canonical = "\n".join([method.upper(), path, timestamp, body_hash])
    digest = hmac.new(shared_secret.encode("utf-8"), canonical.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"sha256={digest}"


# Backwards-compatible helper names used by early drafts.
def build_hmac_signature(shared_secret: str, timestamp: str, method: str, path: str, body: bytes) -> str:
    return build_bridge_signature(
        shared_secret=shared_secret,
        timestamp=timestamp,
        method=method,
        path=path,
        body=body,
    )


def build_signature(shared_secret: str, timestamp: str, body: bytes) -> str:
    return build_bridge_signature(
        shared_secret=shared_secret,
        timestamp=timestamp,
        method="POST",
        path="/api/v1/jobs/enqueue",
        body=body,
    )


def verify_bridge_signature(
    *,
    shared_secret: str,
    timestamp: str,
    signature: str,
    method: str,
    path: str,
    body: bytes,
    now: int | None = None,
    window_seconds: int = 300,
) -> None:
    try:
        timestamp_value = int(timestamp)
    except (TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Python bridge timestamp")

    current_time = int(time.time()) if now is None else int(now)
    if abs(current_time - timestamp_value) > window_seconds:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Expired Python bridge signature")

    expected = build_bridge_signature(
        shared_secret=shared_secret,
        timestamp=timestamp,
        method=method,
        path=path,
        body=body,
    )
    if not hmac.compare_digest(_normalize_signature(signature), _normalize_signature(expected)):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Python bridge signature")


async def require_bridge_secret(
    request: Request,
    x_carepoint_python_secret: str | None = Header(default=None),
    x_carepoint_python_timestamp: str | None = Header(default=None),
    x_carepoint_python_signature: str | None = Header(default=None),
) -> None:
    settings = get_settings()
    if not settings.secret_is_required:
        return

    if not settings.shared_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Python bridge shared secret is required but not configured",
        )

    legacy_secret_valid = bool(settings.allow_legacy_secret_header) and hmac.compare_digest(x_carepoint_python_secret or "", settings.shared_secret)
    signature_valid = False
    if x_carepoint_python_timestamp and x_carepoint_python_signature:
        body = await request.body()
        try:
            verify_bridge_signature(
                shared_secret=settings.shared_secret,
                timestamp=x_carepoint_python_timestamp,
                signature=x_carepoint_python_signature,
                method=request.method,
                path=_path_with_query(request),
                body=body,
                window_seconds=settings.signature_tolerance_seconds,
            )
            signature_valid = True
        except HTTPException:
            if settings.signature_is_required:
                raise
            signature_valid = False

    if settings.signature_is_required:
        if not signature_valid:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Python bridge signature")
        return

    if not legacy_secret_valid and not signature_valid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Python bridge secret")


require_bridge_auth = require_bridge_secret
