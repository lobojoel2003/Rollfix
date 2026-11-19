"""Settings, read from environment variables (see README.md)."""

from functools import lru_cache
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="ROLLFIX_", env_file=".env", extra="ignore")

    database_url: str = Field(
        default="postgresql://rollfix:rollfix@localhost:5432/rollfix",
        description="PostgreSQL connection string.",
    )
    allowed_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:4173", "http://localhost:5173"],
        description="Web origins allowed to call the API (comma-separated in the environment).",
    )
    min_group_size: int = Field(
        default=5, ge=2, description="Groups smaller than this are never shown in stats."
    )
    write_limit_per_hour: int = Field(
        default=30, ge=1, description="Shares, updates and removals allowed per client per hour."
    )
    trust_proxy: bool = Field(
        default=False,
        description="Use X-Forwarded-For for rate limiting (only behind a trusted proxy).",
    )
    stats_cache_seconds: int = Field(default=60, ge=0)
    build_number: str = "dev"
    commit: str = "unknown"

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip().rstrip("/") for origin in value.split(",") if origin.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
