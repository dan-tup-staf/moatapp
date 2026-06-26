from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.config import settings
from app.deps import get_current_user
from app.models.user import User
from app.services.email_sender import send_test_email, smtp_configured

router = APIRouter(prefix="/email", tags=["email"])


class EmailStatus(BaseModel):
    configured: bool
    host: str
    port: int
    from_email: str
    from_name: str
    starttls: bool
    use_tls: bool
    daily_limit: int


class TestEmailRequest(BaseModel):
    to: str | None = None


class TestEmailResult(BaseModel):
    ok: bool
    sent_to: str
    detail: str | None = None


@router.get("/status", response_model=EmailStatus)
async def email_status(current: User = Depends(get_current_user)) -> EmailStatus:
    """Report the configured sending mailbox (no secrets) for the UI."""
    return EmailStatus(
        configured=smtp_configured(),
        host=settings.smtp_host,
        port=settings.smtp_port,
        from_email=settings.smtp_from_email,
        from_name=settings.smtp_from_name,
        starttls=settings.smtp_starttls,
        use_tls=settings.smtp_use_tls,
        daily_limit=settings.smtp_daily_limit,
    )


@router.post("/test", response_model=TestEmailResult)
async def email_test(
    payload: TestEmailRequest,
    current: User = Depends(get_current_user),
) -> TestEmailResult:
    """Send a test email (defaults to the logged-in user's address)."""
    to = (payload.to or current.email).strip()
    if not to:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Brak adresu docelowego",
        )
    try:
        await send_test_email(to)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Wysyłka testowa nie powiodła się: {type(e).__name__}: {e}",
        )
    return TestEmailResult(
        ok=True,
        sent_to=to,
        detail="Wysłano — sprawdź skrzynkę (także folder spam).",
    )
