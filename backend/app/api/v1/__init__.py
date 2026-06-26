from fastapi import APIRouter

from app.api.v1 import (
    auth,
    campaigns,
    crm,
    dashboard,
    domains,
    email,
    health,
    icp,
    leads,
    lists,
    ops,
    signal_sources,
    signals,
    track,
)

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router)
api_router.include_router(lists.router)
api_router.include_router(leads.router)
api_router.include_router(campaigns.router)
api_router.include_router(signal_sources.router)
api_router.include_router(signals.router)
api_router.include_router(dashboard.router)
api_router.include_router(crm.router)
api_router.include_router(icp.router)
api_router.include_router(email.router)
api_router.include_router(domains.router)
api_router.include_router(track.router)
api_router.include_router(ops.router)
