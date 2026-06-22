from __future__ import annotations

import hashlib
from collections import Counter, deque
from datetime import UTC, datetime
from threading import Lock
from typing import Any

from ..compat import model_dump
from ..models import ShadowRecord


def _now_iso() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _shadow_id(record: ShadowRecord, received_at: str) -> str:
    payload = f"{received_at}:{record.method}:{record.route}:{record.correlation_id or ''}"
    return "shadow_" + hashlib.sha256(payload.encode("utf-8")).hexdigest()[:20]


class ShadowStore:
    def __init__(self, maxlen: int = 500) -> None:
        self._items: deque[dict[str, Any]] = deque(maxlen=maxlen)
        self._lock = Lock()

    def reset(self) -> None:
        with self._lock:
            self._items.clear()

    def add(self, record: ShadowRecord) -> dict[str, Any]:
        received_at = _now_iso()
        item = {"id": _shadow_id(record, received_at), "receivedAt": received_at, **model_dump(record, by_alias=True)}
        with self._lock:
            self._items.appendleft(item)
        return item

    def list_recent(self, limit: int = 20) -> list[dict[str, Any]]:
        safe_limit = max(1, min(limit, 100))
        with self._lock:
            return list(self._items)[:safe_limit]

    def summary(self) -> dict[str, Any]:
        with self._lock:
            items = list(self._items)
        by_route = Counter(str(item.get("route", "unknown")) for item in items)
        by_method = Counter(str(item.get("method", "unknown")) for item in items)
        return {
            "totalShadowRecords": len(items),
            "totalShadowRecordsRetained": len(items),
            "byRoute": dict(sorted(by_route.items())),
            "byMethod": dict(sorted(by_method.items())),
            "latestReceivedAt": max((str(item.get("receivedAt")) for item in items), default=None),
        }


shadow_store = ShadowStore()
