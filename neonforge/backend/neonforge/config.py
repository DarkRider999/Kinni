from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, read from NF_* environment variables (or a .env file)."""

    model_config = SettingsConfigDict(env_prefix="NF_", env_file=".env", extra="ignore")

    env: str = "dev"
    database_url: str = "sqlite:///./data/neonforge.db"
    # Empty → in-process queue + event bus (single-process dev mode, API runs the worker loop itself).
    redis_url: str = ""
    storage_dir: Path = Path("./data/storage")
    models_dir: Path = Path("./data/models")
    public_base_url: str = "http://localhost:8000"

    jwt_secret: str = "dev-insecure-change-me"
    jwt_ttl_minutes: int = 60 * 24 * 7
    # Enables POST /v1/auth/dev-login (email only, no password). Never enable in production.
    allow_dev_login: bool = True

    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    # Run the job worker inside the API process (dev / tests). Production runs `neonforge-worker`.
    embedded_worker: bool = True
    worker_concurrency: int = 2
    job_max_attempts: int = 3

    signed_url_ttl_s: int = 3600

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    s.storage_dir.mkdir(parents=True, exist_ok=True)
    s.models_dir.mkdir(parents=True, exist_ok=True)
    if s.is_sqlite:
        db_path = s.database_url.removeprefix("sqlite:///")
        if db_path and db_path != ":memory:":
            Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    return s
