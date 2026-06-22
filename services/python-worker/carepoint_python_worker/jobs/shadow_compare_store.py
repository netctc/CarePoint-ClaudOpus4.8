from __future__ import annotations

import hashlib
import json
from collections import Counter, deque
from copy import deepcopy
from datetime import UTC, datetime
from threading import Lock
from typing import Any

from ..compat import model_dump
from ..models import ShadowComparisonInput

VOLATILE_FIELDS = {
    "createdAt",
    "updatedAt",
    "receivedAt",
    "completedAt",
    "startedAt",
    "durationMs",
    "latencyMs",
    "requestId",
    "correlationId",
    "traceId",
    "spanId",
    "timestamp",
    "timestamps",
}

BLOCKED_FIELD_FRAGMENTS = (
    "accesstoken",
    "authorization",
    "cookie",
    "password",
    "refreshtoken",
    "secret",
    "token",
    "apikey",
    "api_key",
    "ssn",
    "diagnosis",
    "clinicalnote",
    "medicalrecord",
    "fullchart",
    "prescription",
)


def _now_iso() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _normalize_key(key: str) -> str:
    return "".join(ch for ch in key.lower() if ch.isalnum() or ch == "_")


def _stable_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)


def _hash(value: Any) -> str:
    return hashlib.sha256(_stable_json(value).encode("utf-8")).hexdigest()


def _flatten_keys(value: Any, prefix: str = "") -> set[str]:
    if isinstance(value, dict):
        keys: set[str] = set()
        for key, nested in value.items():
            path = f"{prefix}.{key}" if prefix else str(key)
            keys.add(path)
            keys.update(_flatten_keys(nested, path))
        return keys
    if isinstance(value, list):
        keys: set[str] = set()
        for index, nested in enumerate(value):
            keys.update(_flatten_keys(nested, f"{prefix}[{index}]"))
        return keys
    return set()


def _leaf_values(value: Any, prefix: str = "") -> dict[str, str]:
    if isinstance(value, dict):
        result: dict[str, str] = {}
        for key, nested in value.items():
            path = f"{prefix}.{key}" if prefix else str(key)
            result.update(_leaf_values(nested, path))
        return result
    if isinstance(value, list):
        result: dict[str, str] = {}
        for index, nested in enumerate(value):
            result.update(_leaf_values(nested, f"{prefix}[{index}]"))
        return result
    return {prefix or "$": _stable_json(value)}


def _remove_ignored(value: Any, ignored_fields: set[str]) -> Any:
    if isinstance(value, dict):
        cleaned: dict[str, Any] = {}
        for key, nested in value.items():
            if key in ignored_fields or key in VOLATILE_FIELDS:
                continue
            cleaned[key] = _remove_ignored(nested, ignored_fields)
        return cleaned
    if isinstance(value, list):
        return [_remove_ignored(item, ignored_fields) for item in value]
    return value


def _blocked_paths(value: Any, path: str = "") -> list[str]:
    blocked: list[str] = []
    if isinstance(value, dict):
        for raw_key, nested in value.items():
            key = str(raw_key)
            normalized = _normalize_key(key)
            next_path = f"{path}.{key}" if path else key
            if any(fragment in normalized for fragment in BLOCKED_FIELD_FRAGMENTS):
                blocked.append(next_path)
                continue
            blocked.extend(_blocked_paths(nested, next_path))
    elif isinstance(value, list):
        for index, item in enumerate(value):
            blocked.extend(_blocked_paths(item, f"{path}[{index}]"))
    return blocked


def _comparison_id(record: ShadowComparisonInput, received_at: str) -> str:
    payload = f"{received_at}:{record.method}:{record.route}:{record.correlation_id or ''}:{record.subject_key or ''}"
    return "cmp_" + hashlib.sha256(payload.encode("utf-8")).hexdigest()[:20]


class ShadowComparisonStore:
    def __init__(self, maxlen: int = 500) -> None:
        self._items: deque[dict[str, Any]] = deque(maxlen=maxlen)
        self._lock = Lock()

    def reset(self) -> None:
        with self._lock:
            self._items.clear()

    def compare(self, record: ShadowComparisonInput) -> dict[str, Any]:
        node_raw = deepcopy(record.node_result)
        python_raw = deepcopy(record.python_result)
        blocked = sorted(set(_blocked_paths(node_raw) + _blocked_paths(python_raw)))
        if blocked:
            raise ValueError("shadow comparison payload contains blocked sensitive fields: " + ", ".join(blocked[:20]))

        ignored_fields = set(record.ignored_fields) | VOLATILE_FIELDS
        node_clean = _remove_ignored(node_raw, ignored_fields)
        python_clean = _remove_ignored(python_raw, ignored_fields)
        node_hash = _hash(node_clean)
        python_hash = _hash(python_clean)
        node_keys = _flatten_keys(node_clean)
        python_keys = _flatten_keys(python_clean)
        shape_mismatch_keys = sorted(node_keys.symmetric_difference(python_keys))
        node_leaf_values = _leaf_values(node_clean)
        python_leaf_values = _leaf_values(python_clean)
        shared_leaf_keys = sorted(set(node_leaf_values).intersection(python_leaf_values))
        value_mismatch_keys = [key for key in shared_leaf_keys if node_leaf_values[key] != python_leaf_values[key]]

        if node_hash == python_hash:
            outcome = "match"
        elif shape_mismatch_keys:
            outcome = "shape_mismatch"
        else:
            outcome = "value_mismatch"

        received_at = _now_iso()
        item = {
            "id": _comparison_id(record, received_at),
            "receivedAt": received_at,
            "outcome": outcome,
            "nodeHash": node_hash,
            "pythonHash": python_hash,
            "shapeMismatchKeys": shape_mismatch_keys[:100],
            "valueMismatchKeys": value_mismatch_keys[:100],
            "mismatchCount": len(shape_mismatch_keys) + len(value_mismatch_keys),
            "comparison": model_dump(record, by_alias=True),
            "payloadClassification": record.payload_classification,
        }
        with self._lock:
            self._items.appendleft(item)
        return item

    def list_recent(self, limit: int = 20, outcome: str | None = None) -> list[dict[str, Any]]:
        safe_limit = max(1, min(limit, 100))
        with self._lock:
            items = list(self._items)
        if outcome:
            items = [item for item in items if item.get("outcome") == outcome]
        return items[:safe_limit]

    def summary(self) -> dict[str, Any]:
        with self._lock:
            items = list(self._items)
        by_outcome = Counter(str(item.get("outcome", "unknown")) for item in items)
        total = len(items)
        mismatches = total - by_outcome.get("match", 0)
        return {
            "totalComparisons": total,
            "totalComparisonsRetained": len(items),
            "matchedComparisons": by_outcome.get("match", 0),
            "mismatchedComparisons": mismatches,
            "mismatchRate": (mismatches / total) if total else 0,
            "byOutcome": dict(sorted(by_outcome.items())),
            "latestReceivedAt": max((str(item.get("receivedAt")) for item in items), default=None),
        }


shadow_comparison_store = ShadowComparisonStore()
