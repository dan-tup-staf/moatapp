from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    environment: str = "development"

    database_url: str = "postgresql+asyncpg://moatapp:moatapp@postgres:5432/moatapp"
    redis_url: str = "redis://redis:6379/0"

    # SMTP sending mailbox. Defaults target Mailhog (dev). For real delivery,
    # set host/port + credentials of your provider (e.g. Gmail/Workspace:
    # smtp.gmail.com:587 starttls with an App Password, or Resend/Postmark/SES).
    smtp_host: str = "mailhog"
    smtp_port: int = 1025
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_starttls: bool = False  # True for port 587 (Gmail/Workspace)
    smtp_use_tls: bool = False  # True for port 465 (implicit TLS)
    # Address mail is actually sent from. When set, overrides per-campaign
    # from_email so the From matches the authenticated mailbox (deliverability).
    smtp_from_email: str = ""
    smtp_from_name: str = ""
    # Safety cap on outbound emails per day across the instance (deliverability
    # / cold-start protection). 0 = unlimited.
    smtp_daily_limit: int = 50

    # In-process scheduler: when enabled, the API itself ticks on an interval to
    # send due campaign emails (and optionally run signal scrapers). On free
    # hosting the service sleeps when idle, so also expose /api/v1/tick for an
    # external cron to drive it reliably (see cron_secret).
    scheduler_enabled: bool = True
    scheduler_interval_seconds: int = 60
    # Auto-run signal scrapers from the scheduler (uses AI quota for web
    # channels) — off by default; trigger manually or via /tick?signals=true.
    scheduler_run_signals: bool = False
    signal_interval_seconds: int = 900
    # Shared secret guarding /api/v1/tick. Empty = endpoint disabled.
    cron_secret: str = ""

    # DNS-over-HTTPS endpoint for domain health checks (SPF/DKIM/DMARC/MX).
    doh_url: str = "https://dns.google/resolve"

    jwt_secret: str = "change-me-in-prod"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24

    cors_origins: list[str] = ["http://localhost:3000"]
    # For hosted demos behind a separate frontend origin: allow any origin.
    # Safe here because auth is Bearer-token (no cookies) — we disable
    # credentialed CORS when this is on. Keep False in real production.
    cors_allow_all: bool = False

    # AI provider for ICP + web_search signal channels. First configured wins;
    # Gemini is preferred when both are set (it's free). Empty for both = those
    # features disabled (rest of app works).
    #
    # Google Gemini — free tier with native Google Search grounding (the cheap
    # default). Get a key at https://aistudio.google.com.
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"

    # Anthropic API — paid alternative; uses the server-side web_search tool.
    anthropic_api_key: str = ""
    # Optional override (e.g. an Anthropic-compatible gateway). Empty = official API.
    anthropic_base_url: str = ""
    anthropic_model_fast: str = "claude-haiku-4-5"
    anthropic_model_quality: str = "claude-sonnet-4-6"


settings = Settings()
