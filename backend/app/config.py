from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    environment: str = "development"

    database_url: str = "postgresql+asyncpg://moatapp:moatapp@postgres:5432/moatapp"
    redis_url: str = "redis://redis:6379/0"

    smtp_host: str = "mailhog"
    smtp_port: int = 1025

    jwt_secret: str = "change-me-in-prod"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24

    cors_origins: list[str] = ["http://localhost:3000"]

    # Anthropic API — needed only for ICP feature; empty = feature disabled
    anthropic_api_key: str = ""
    anthropic_model_fast: str = "claude-haiku-4-5"
    anthropic_model_quality: str = "claude-sonnet-4-6"


settings = Settings()
