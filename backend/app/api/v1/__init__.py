from fastapi import APIRouter

from app.api.v1 import auth, campaigns, health, leads, lists

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router)
api_router.include_router(lists.router)
api_router.include_router(leads.router)
api_router.include_router(campaigns.router)
