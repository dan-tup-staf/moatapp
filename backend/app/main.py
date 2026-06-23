from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import api_router
from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup hooks go here (db connections, etc.)
    yield
    # shutdown hooks


def create_app() -> FastAPI:
    app = FastAPI(
        title="MOATION API",
        version="0.1.0",
        lifespan=lifespan,
    )

    # Bearer-token auth means we don't rely on cookies, so wildcard CORS is
    # acceptable for hosted demos. allow_credentials must be False with "*".
    if settings.cors_allow_all:
        allow_origins = ["*"]
        allow_credentials = False
    else:
        allow_origins = settings.cors_origins
        allow_credentials = True

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins,
        allow_credentials=allow_credentials,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix="/api/v1")

    return app


app = create_app()
