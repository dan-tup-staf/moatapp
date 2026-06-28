from pydantic import BaseModel, EmailStr, Field


class ProfileUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = None


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=72)


class PlanLimit(BaseModel):
    key: str
    label: str
    used: int | None = None
    limit: int | None = None  # None = unlimited


class PlanInfo(BaseModel):
    key: str
    name: str
    price_pln: int | None
    period: str
    features: list[str]
    status: str
    is_current: bool = False
    can_checkout: bool = False  # Stripe configured for this plan


class AccountOverview(BaseModel):
    id: int
    email: EmailStr
    name: str | None
    plan: str
    plan_status: str
    billing_enabled: bool  # Stripe configured at all
    usage: list[PlanLimit]
    plans: list[PlanInfo]


class CheckoutRequest(BaseModel):
    plan: str = Field(pattern="^(pro|scale)$")


class CheckoutResponse(BaseModel):
    url: str | None = None
    # When Stripe isn't configured we return a preview message instead.
    preview: bool = False
    message: str | None = None
