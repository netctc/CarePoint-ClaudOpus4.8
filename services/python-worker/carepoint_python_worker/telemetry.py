import logging
from typing import Any

from fastapi import FastAPI

from .config import get_settings


logger = logging.getLogger("carepoint.python_worker")


def configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )


def configure_telemetry(app: FastAPI) -> None:
    settings = get_settings()
    if not settings.otel_enabled:
        return
    try:
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

        FastAPIInstrumentor.instrument_app(app, service_name=settings.service_name)
    except Exception as exc:  # pragma: no cover - telemetry must not block startup
        logger.warning("otel_instrumentation_failed", extra={"error": str(exc)})


def safe_log(event: str, **fields: Any) -> None:
    # Avoid PHI/PII values in structured logs. Callers should pass counts, ids, and shapes only.
    logger.info(event, extra={"carepoint": fields})
