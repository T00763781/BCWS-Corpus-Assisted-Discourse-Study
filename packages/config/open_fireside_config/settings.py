from __future__ import annotations

from functools import lru_cache
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="OPEN_FIRESIDE_", env_file=".env", extra="ignore")

    app_env: str = "development"
    db_url: str = "sqlite:///./data/open_fireside.db"
    data_dir: str = "./data"
    log_level: str = "INFO"
    endpoint_catalog: str = "./seed/endpoints/bcws_endpoints.csv"
    api_prefix: str = "/api"
    cors_allowed_origins: list[str] = [
        "http://localhost:1420",
        "http://127.0.0.1:1420",
        "tauri://localhost",
    ]

    @field_validator("api_prefix")
    @classmethod
    def normalize_api_prefix(cls, value: str) -> str:
        normalized = value.strip() or "/api"
        if not normalized.startswith("/"):
            normalized = f"/{normalized}"
        return normalized.rstrip("/") or "/api"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
