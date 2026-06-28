"""Sequence goal ("Cel sekwencji") execution.

When a campaign's goal is reached for a prospect, push the converted lead to the
configured CRM as a contact, a sales task, or a deal. Until per-provider API
calls are wired, the push goes out via the generic webhook (so it works today).
"""

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.campaign import Campaign
from app.models.campaign_enrollment import CampaignEnrollment
from app.models.lead import Lead
from app.services import crm_integrations

logger = logging.getLogger(__name__)

# Goal trigger → the outcome we set when it fires.
GOAL_OUTCOME = "closed_won"


# Outcomes that auto-fire the goal when set on a prospect.
GOAL_TRIGGER_OUTCOMES = {"meeting_booked", "closed_won"}


async def execute_goal(
    db: AsyncSession,
    user_id: int,
    campaign: Campaign,
    enrollment: CampaignEnrollment,
    lead: Lead,
    mark_outcome: bool = True,
) -> dict:
    """Run the campaign's goal CRM action for this enrollment. Returns a small
    result dict. No-op (skipped) when no CRM action is configured. When
    `mark_outcome` is True the prospect is marked converted (closed_won)."""
    action = getattr(campaign, "goal_crm_action", "none") or "none"
    if action == "none":
        return {"skipped": True, "reason": "no-goal-action"}

    provider = getattr(campaign, "goal_crm_provider", None)
    full_name = " ".join(filter(None, [lead.first_name, lead.last_name]))
    contact = {
        "email": lead.email,
        "name": full_name or None,
        "first_name": lead.first_name,
        "last_name": lead.last_name,
        "company": lead.company,
        "title": lead.title,
        "linkedin_url": lead.linkedin_url,
    }
    payload: dict = {
        "campaign_id": campaign.id,
        "campaign_name": campaign.name,
        "goal_type": getattr(campaign, "goal_type", "none"),
        "contact": contact,
    }
    if action == "task":
        payload["task"] = {
            "note": getattr(campaign, "goal_task_note", None)
            or f"Skontaktuj się — cel sekwencji „{campaign.name}” osiągnięty",
        }
    elif action == "deal":
        payload["deal"] = {
            "value": getattr(campaign, "goal_deal_value", None)
            or getattr(campaign, "deal_value", None),
            "title": f"{lead.company or full_name or lead.email} — {campaign.name}",
        }

    result = await crm_integrations.push(db, user_id, provider, action, payload)

    # Mark the prospect as converted (manual trigger only).
    if mark_outcome:
        enrollment.outcome = GOAL_OUTCOME
        await db.commit()
    logger.info(
        "Sequence goal executed: campaign=%s lead=%s action=%s provider=%s",
        campaign.id,
        lead.id,
        action,
        provider,
    )
    return {"skipped": False, "action": action, "provider": provider, **result}
