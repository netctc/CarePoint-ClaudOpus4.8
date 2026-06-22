from functools import lru_cache
from pathlib import Path

from pydantic import Field

try:  # pydantic v2 runtime
    from pydantic_settings import BaseSettings
except ImportError:  # pydantic v1 lightweight test runtime
    from pydantic import BaseSettings


class Settings(BaseSettings):
    service_name: str = "carepoint-python-worker"
    node_env: str = Field(default="development", alias="NODE_ENV", env="NODE_ENV")
    api_port: int = Field(default=8010, alias="PYTHON_WORKER_API_PORT", env="PYTHON_WORKER_API_PORT")
    redis_url: str = Field(default="redis://localhost:6379", alias="REDIS_URL", env="REDIS_URL")
    celery_broker_url: str | None = Field(default=None, alias="CELERY_BROKER_URL", env="CELERY_BROKER_URL")
    celery_result_backend: str | None = Field(default=None, alias="CELERY_RESULT_BACKEND", env="CELERY_RESULT_BACKEND")
    database_url: str | None = Field(default=None, alias="DATABASE_URL", env="DATABASE_URL")
    shared_secret: str = Field(default="", alias="PYTHON_SERVICES_SHARED_SECRET", env="PYTHON_SERVICES_SHARED_SECRET")
    queue_enabled: bool = Field(default=False, alias="PYTHON_WORKER_QUEUE_ENABLED", env="PYTHON_WORKER_QUEUE_ENABLED")
    require_shared_secret: bool = Field(default=False, alias="PYTHON_WORKER_REQUIRE_SHARED_SECRET", env="PYTHON_WORKER_REQUIRE_SHARED_SECRET")
    require_signature: bool = Field(default=False, alias="PYTHON_WORKER_REQUIRE_SIGNATURE", env="PYTHON_WORKER_REQUIRE_SIGNATURE")
    allow_legacy_secret_header: bool = Field(default=True, alias="PYTHON_WORKER_ALLOW_LEGACY_SECRET_HEADER", env="PYTHON_WORKER_ALLOW_LEGACY_SECRET_HEADER")
    signature_tolerance_seconds: int = Field(default=300, alias="PYTHON_WORKER_SIGNATURE_TOLERANCE_SECONDS", env="PYTHON_WORKER_SIGNATURE_TOLERANCE_SECONDS")
    artifact_storage_dir: str = Field(default="/tmp/carepoint-python-worker/artifacts", alias="PYTHON_WORKER_ARTIFACT_STORAGE_DIR", env="PYTHON_WORKER_ARTIFACT_STORAGE_DIR")
    artifact_public_base_url: str | None = Field(default=None, alias="PYTHON_WORKER_ARTIFACT_PUBLIC_BASE_URL", env="PYTHON_WORKER_ARTIFACT_PUBLIC_BASE_URL")
    artifact_ttl_seconds: int = Field(default=86400, alias="PYTHON_WORKER_ARTIFACT_TTL_SECONDS", env="PYTHON_WORKER_ARTIFACT_TTL_SECONDS")
    job_status_redis_enabled: bool = Field(default=False, alias="PYTHON_WORKER_JOB_STATUS_REDIS_ENABLED", env="PYTHON_WORKER_JOB_STATUS_REDIS_ENABLED")
    job_status_redis_prefix: str = Field(default="carepoint:python-worker:jobs", alias="PYTHON_WORKER_JOB_STATUS_REDIS_PREFIX", env="PYTHON_WORKER_JOB_STATUS_REDIS_PREFIX")
    job_status_ttl_seconds: int = Field(default=86400, alias="PYTHON_WORKER_JOB_STATUS_TTL_SECONDS", env="PYTHON_WORKER_JOB_STATUS_TTL_SECONDS")
    metrics_enabled: bool = Field(default=True, alias="PYTHON_WORKER_METRICS_ENABLED", env="PYTHON_WORKER_METRICS_ENABLED")
    otel_enabled: bool = Field(default=False, alias="PYTHON_WORKER_OTEL_ENABLED", env="PYTHON_WORKER_OTEL_ENABLED")
    rollout_state_path: str = Field(default="/tmp/carepoint-python-worker/rollout-state.json", alias="PYTHON_WORKER_ROLLOUT_STATE_PATH", env="PYTHON_WORKER_ROLLOUT_STATE_PATH")

    class Config:
        env_prefix = ""
        env_file = (".env", ".env.local")
        extra = "ignore"
        populate_by_name = True

    @property
    def is_production(self) -> bool:
        return self.node_env == "production"

    @property
    def broker_url(self) -> str:
        return self.celery_broker_url or self.redis_url

    @property
    def result_backend_url(self) -> str:
        return self.celery_result_backend or self.redis_url

    @property
    def secret_is_required(self) -> bool:
        return self.require_shared_secret or self.require_signature or self.is_production or bool(self.shared_secret)

    @property
    def signature_is_required(self) -> bool:
        return self.require_signature or self.is_production

    @property
    def signature_skew_seconds(self) -> int:
        # Backwards-compatible property name from early Option B drafts.
        return self.signature_tolerance_seconds

    @property
    def status_backend(self) -> str:
        return "redis" if self.job_status_redis_enabled else "memory"

    @property
    def artifact_root(self) -> str:
        # Backwards-compatible property name from early Option B drafts.
        return self.artifact_storage_dir

    @property
    def artifact_root_path(self) -> Path:
        return Path(self.artifact_storage_dir).expanduser().resolve()

    @property
    def rollout_state_file(self) -> Path:
        return Path(self.rollout_state_path).expanduser().resolve()


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
