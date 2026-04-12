"""Application configuration loaded from environment variables."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings from environment."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    supabase_url: str = ""
    supabase_service_role_key: str = ""
    openai_api_key: str = ""
    frontend_origin: str = "http://localhost:8080"
    environment: str = "development"

    # Twilio — required only for real call ingestion via /api/twilio/*
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_demo_agent_email: str = ""

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    """Return application settings (cached)."""
    return Settings()
