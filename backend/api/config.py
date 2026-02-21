"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings from environment."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    supabase_url: str = ""
    supabase_key: str = ""


def get_settings() -> Settings:
    """Return application settings (cached per request via Depends)."""
    return Settings()
