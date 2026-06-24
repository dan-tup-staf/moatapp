from collections.abc import AsyncGenerator
from typing import Any

from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings


def build_async_db_args() -> tuple[str, dict[str, Any]]:
    """Normalize DATABASE_URL into an asyncpg-friendly (url, connect_args) pair.

    Tolerates the connection strings handed out by managed Postgres providers
    (Neon, Render, Supabase, Heroku) which use the libpq scheme `postgres://`
    and libpq query params like `sslmode=require` / `channel_binding=require`
    that asyncpg does not understand. We:
      - rewrite `postgres://` / bare `postgresql://` → `postgresql+asyncpg://`
      - drop libpq-only params and translate SSL intent into connect_args
    so users can paste a provider URL verbatim."""
    raw = (settings.database_url or "").strip()
    if raw.startswith("postgres://"):
        raw = "postgresql://" + raw[len("postgres://") :]

    url = make_url(raw)
    if url.drivername in ("postgresql", "postgresql+psycopg2", "postgresql+psycopg"):
        url = url.set(drivername="postgresql+asyncpg")

    query = dict(url.query)
    connect_args: dict[str, Any] = {}

    sslmode = query.pop("sslmode", None)
    query.pop("channel_binding", None)  # libpq-only, asyncpg chokes on it
    ssl_param = query.pop("ssl", None)

    wants_ssl = (sslmode is not None and sslmode != "disable") or (
        ssl_param is not None and ssl_param not in ("0", "false", "disable")
    )
    if wants_ssl:
        connect_args["ssl"] = True

    # Disable asyncpg's prepared-statement cache: harmless on direct Postgres,
    # but required when connecting through a transaction pooler (Neon's
    # `-pooler` endpoint / PgBouncer) which otherwise breaks prepared statements.
    connect_args["statement_cache_size"] = 0

    url = url.set(query=query)
    return url.render_as_string(hide_password=False), connect_args


_db_url, _connect_args = build_async_db_args()

engine = create_async_engine(
    _db_url,
    echo=False,
    future=True,
    pool_pre_ping=True,
    connect_args=_connect_args,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
