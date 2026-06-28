from fastapi import APIRouter

from app.api.v1 import (
    account,
    auth,
    campaign_groups,
    crm_integrations,
    enrichment,
    campaigns,
    crm,
    dashboard,
    domains,
    email,
    email_accounts,
    health,
    icp,
    inbox,
    leads,
    linkedin_accounts,
    lists,
    ops,
    scoring,
    signal_sources,
    signals,
    track,
    trigger_integrations,
    watchlists,
    webhooks,
)

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router)
api_router.include_router(account.router)
api_router.include_router(lists.router)
api_router.include_router(leads.router)
api_router.include_router(campaigns.router)
api_router.include_router(campaign_groups.router)
api_router.include_router(signal_sources.router)
api_router.include_router(scoring.router)
api_router.include_router(enrichment.router)
api_router.include_router(crm_integrations.router)
api_router.include_router(trigger_integrations.router)
api_router.include_router(watchlists.router)
api_router.include_router(signals.router)
api_router.include_router(dashboard.router)
api_router.include_router(crm.router)
api_router.include_router(icp.router)
api_router.include_router(email.router)
api_router.include_router(domains.router)
api_router.include_router(email_accounts.router)
api_router.include_router(linkedin_accounts.router)
api_router.include_router(inbox.router)
api_router.include_router(webhooks.router)
api_router.include_router(track.router)
api_router.include_router(ops.router)
