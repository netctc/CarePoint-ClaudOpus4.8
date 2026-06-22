from __future__ import annotations

import json
from collections import Counter
from datetime import UTC, datetime
from threading import RLock
from typing import Any

from ..compat import model_dump, model_validate
from ..models import JobAccepted, JobEnvelope, JobRecord, JobResult, JobStatus
from ..config import get_settings
from ..services.job_router import JOB_ROUTES, build_job_id


def utc_now_iso() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


class HybridJobStore:
    def __init__(self) -> None:
        self._lock = RLock()
        self._records: dict[str, JobRecord] = {}
        self._job_id_index: dict[str, str] = {}
        self._redis_client: Any | None = None

    def reset(self) -> None:
        with self._lock:
            self._records.clear()
            self._job_id_index.clear()

    def get(self, lookup: str) -> JobRecord | None:
        return self.find(lookup)

    def find(self, lookup: str) -> JobRecord | None:
        with self._lock:
            key = self._job_id_index.get(lookup, lookup)
            record = self._records.get(key)
        if record is not None:
            return record
        loaded = self._load_from_redis(lookup)
        if loaded is not None:
            self._index(loaded)
        return loaded

    def list_recent(self, limit: int = 50, status: JobStatus | None = None) -> list[JobRecord]:
        safe_limit = max(1, min(limit, 200))
        with self._lock:
            records = list(self._records.values())
        if status is not None:
            records = [record for record in records if record.status == status]
        records.sort(key=lambda record: record.updated_at, reverse=True)
        return records[:safe_limit]

    def summary(self) -> dict[str, Any]:
        with self._lock:
            records = list(self._records.values())
        by_status = Counter(record.status.value for record in records)
        by_type = Counter(record.job_type.value for record in records)
        return {
            "total": len(records),
            "totalJobs": len(records),
            "byStatus": dict(sorted(by_status.items())),
            "byJobType": dict(sorted(by_type.items())),
            "inFlightJobs": sum(
                by_status.get(status, 0)
                for status in [JobStatus.ACCEPTED.value, JobStatus.QUEUED.value, JobStatus.RUNNING.value]
            ),
            "failedJobs": by_status.get(JobStatus.FAILED.value, 0),
            "succeededJobs": by_status.get(JobStatus.SUCCEEDED.value, 0),
            "latestUpdatedAt": max((record.updated_at for record in records), default=None),
        }

    def accept(self, job: JobEnvelope, accepted: JobAccepted, status: JobStatus) -> JobRecord:
        now = utc_now_iso()
        record = JobRecord(
            jobId=accepted.job_id,
            jobType=job.job_type,
            idempotencyKey=job.idempotency_key,
            correlationId=job.correlation_id,
            organizationId=job.organization_id,
            actorUserId=job.actor_user_id,
            status=status,
            routedTo=accepted.routed_to,
            queued=accepted.queued,
            taskId=accepted.task_id,
            dryRun=job.dry_run,
            attempts=0,
            createdAt=now,
            updatedAt=now,
            result=None,
            error=None,
            canceledReason=None,
        )
        self._save(record)
        return record

    def running(self, job: JobEnvelope, task_id: str | None = None) -> JobRecord:
        return self.mark_running(job, task_id=task_id, queued=True)

    def mark_running(self, job: JobEnvelope, task_id: str | None = None, queued: bool | None = None) -> JobRecord:
        now = utc_now_iso()
        record = self.find(job.idempotency_key)
        if record is None:
            route = JOB_ROUTES[job.job_type]
            record = JobRecord(
                jobId=build_job_id(job.idempotency_key),
                jobType=job.job_type,
                idempotencyKey=job.idempotency_key,
                correlationId=job.correlation_id,
                organizationId=job.organization_id,
                actorUserId=job.actor_user_id,
                status=JobStatus.RUNNING,
                routedTo=route.routed_to,
                queued=bool(queued),
                taskId=task_id,
                dryRun=job.dry_run,
                attempts=1,
                createdAt=now,
                updatedAt=now,
                result=None,
                error=None,
                canceledReason=None,
            )
        else:
            record.status = JobStatus.RUNNING
            record.updated_at = now
            record.attempts = (record.attempts or 0) + 1
            if queued is not None:
                record.queued = queued
            if task_id:
                record.task_id = task_id
        self._save(record)
        return record

    def succeed(self, job: JobEnvelope, result: JobResult) -> JobRecord:
        now = utc_now_iso()
        record = self.find(job.idempotency_key)
        if record is None:
            self.mark_running(job, queued=False)
            record = self.find(job.idempotency_key)
            assert record is not None
        record.status = JobStatus.SUCCEEDED
        record.updated_at = now
        record.result = result
        record.error = None
        self._save(record)
        return record

    def fail(self, job: JobEnvelope, error: str) -> JobRecord:
        now = utc_now_iso()
        record = self.find(job.idempotency_key)
        if record is None:
            self.mark_running(job, queued=False)
            record = self.find(job.idempotency_key)
            assert record is not None
        record.status = JobStatus.FAILED
        record.updated_at = now
        record.error = error
        self._save(record)
        return record

    def cancel(self, lookup: str, reason: str) -> JobRecord | None:
        record = self.find(lookup)
        if record is None:
            return None
        record.status = JobStatus.CANCELED
        record.updated_at = utc_now_iso()
        record.canceled_reason = reason
        self._save(record)
        return record

    def _index(self, record: JobRecord) -> None:
        with self._lock:
            self._records[record.idempotency_key] = record
            self._job_id_index[record.job_id] = record.idempotency_key

    def _save(self, record: JobRecord) -> None:
        self._index(record)
        self._save_to_redis(record)

    def _redis_key(self, lookup: str) -> str:
        settings = get_settings()
        return f"{settings.job_status_redis_prefix}:{lookup}"

    def _redis(self):  # pragma: no cover - network dependent
        settings = get_settings()
        if not settings.job_status_redis_enabled:
            return None
        if self._redis_client is None:
            import redis

            self._redis_client = redis.from_url(settings.redis_url, socket_connect_timeout=2, socket_timeout=2)
        return self._redis_client

    def _save_to_redis(self, record: JobRecord) -> None:  # pragma: no cover - network dependent
        client = self._redis()
        if client is None:
            return
        settings = get_settings()
        payload = json.dumps(model_dump(record, by_alias=True, mode="json"), sort_keys=True, default=str)
        for lookup in {record.idempotency_key, record.job_id}:
            client.setex(self._redis_key(lookup), settings.job_status_ttl_seconds, payload)

    def _load_from_redis(self, lookup: str) -> JobRecord | None:  # pragma: no cover - network dependent
        client = self._redis()
        if client is None:
            return None
        raw = client.get(self._redis_key(lookup))
        if raw is None:
            return None
        if isinstance(raw, bytes):
            raw = raw.decode("utf-8")
        return model_validate(JobRecord, json.loads(raw))


job_store = HybridJobStore()
