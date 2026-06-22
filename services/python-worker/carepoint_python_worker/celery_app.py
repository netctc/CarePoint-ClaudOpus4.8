from __future__ import annotations

from uuid import uuid4

try:  # pragma: no cover - real worker image path
    from celery import Celery
except ImportError:  # lightweight fallback for local contract tests without optional runtime deps
    class _FallbackRequest:
        id = f"fallback-{uuid4()}"

    class _FallbackTaskResult:
        def __init__(self) -> None:
            self.id = f"fallback-{uuid4()}"

    class _FallbackConf:
        def update(self, **_kwargs) -> None:
            return None

    class Celery:  # type: ignore[no-redef]
        def __init__(self, *_args, **_kwargs) -> None:
            self.conf = _FallbackConf()

        def send_task(self, *_args, **_kwargs) -> _FallbackTaskResult:
            return _FallbackTaskResult()

        def task(self, *d_args, **_d_kwargs):
            def decorator(func):
                def wrapper(*args, **kwargs):
                    return func(*args, **kwargs)
                wrapper.request = _FallbackRequest()
                return wrapper

            if d_args and callable(d_args[0]):
                return decorator(d_args[0])
            return decorator

from .compat import model_dump, model_validate
from .config import get_settings
from .jobs.processors import process_job
from .jobs.store import job_store
from .models import JobEnvelope
from .policies import evaluate_job_policy

settings = get_settings()

celery_app = Celery(
    "carepoint_python_worker",
    broker=settings.broker_url,
    backend=settings.result_backend_url,
)
celery_app.conf.update(task_track_started=True, task_time_limit=600, worker_prefetch_multiplier=1)


@celery_app.task(name="carepoint.jobs.handle", bind=True)
def handle_job(self, raw_job: dict) -> dict:
    job = model_validate(JobEnvelope, raw_job)
    decision = evaluate_job_policy(job)
    if not decision.allowed:
        record = job_store.fail(job, f"policy blocked: {', '.join(decision.blocked_paths)}")
        return model_dump(record, by_alias=True, mode="json")
    job_store.mark_running(job, task_id=getattr(getattr(self, "request", None), "id", None), queued=True)
    try:
        result = process_job(job)
        if decision.warnings:
            result.warnings = [*decision.warnings, *result.warnings]
        record = job_store.succeed(job, result)
        return model_dump(record, by_alias=True, mode="json")
    except Exception as exc:
        job_store.fail(job, str(exc))
        raise
