# MOATION

Narzędzie do prospectingu (cold outreach) połączone z silnikiem sygnałów zakupowych (buying signals / intent data).

## Stack

- **Backend:** FastAPI + SQLAlchemy 2.0 + Alembic + ARQ (Redis) + Playwright
- **Frontend:** Next.js 15 + TypeScript + Tailwind
- **DB:** Postgres 16
- **Queue:** Redis 7
- **Dev mail:** Mailhog

## Szybki start (lokalnie)

Wymagane: Docker + Docker Compose.

```bash
cp .env.example .env
docker compose up -d
```

Serwisy:

| Serwis     | URL / Port                         |
|------------|------------------------------------|
| Web        | http://localhost:3000              |
| API health | http://localhost:8000/api/v1/health |
| API docs   | http://localhost:8000/docs         |
| Mailhog    | http://localhost:8025              |
| Postgres   | localhost:5432                     |
| Redis      | localhost:6379                     |

## Struktura

```
MOATAPP/
├── backend/     # FastAPI + workers + scrapery
├── frontend/    # Next.js 15
└── docker-compose.yml
```

## Status

🚧 Pre-MVP — scaffolding. Zobacz `.claude/plans/` po szczegóły planu MVP.
