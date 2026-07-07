"""Pydantic input schemas. Read endpoints return enriched dicts built in
serializers.py so lists carry display names without extra client round-trips."""
from datetime import date, datetime

from pydantic import BaseModel, EmailStr, Field


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class AccountIn(BaseModel):
    name: str
    industry: str | None = None
    segment: str = "smb"
    country: str | None = None
    website: str | None = None
    tax_id: str | None = None
    owner_id: int | None = None
    status: str = "prospect"
    annual_revenue: float | None = None
    notes: str | None = None


class ContactIn(BaseModel):
    account_id: int
    name: str
    role_title: str | None = None
    email: str | None = None
    phone: str | None = None
    whatsapp: str | None = None
    linkedin: str | None = None
    is_decision_maker: bool = False
    preferred_language: str = "en"


class OpportunityIn(BaseModel):
    name: str
    account_id: int
    primary_contact_id: int | None = None
    owner_id: int | None = None
    amount: float | None = None
    currency: str = "USD"
    probability: float | None = None
    expected_close_date: date | None = None
    source: str | None = None
    product_line: str | None = None
    competitors: str | None = None
    next_step: str | None = None
    stage_id: int | None = None


class StageChangeIn(BaseModel):
    stage_id: int
    loss_reason: str | None = None
    create_project: bool = False


class LineItemIn(BaseModel):
    product_id: int
    quantity: float = 1
    unit_price: float = 0
    discount_pct: float = 0


class SaleIn(BaseModel):
    opportunity_id: int | None = None
    account_id: int
    contract_value: float = 0
    currency: str = "USD"
    billing_type: str = "one_off"
    mrr: float | None = None
    start_date: date | None = None
    term_months: int | None = None
    invoicing_status: str = "not_invoiced"


class MilestoneIn(BaseModel):
    id: int | None = None
    name: str
    due_date: date | None = None
    is_done: bool = False


class ProjectIn(BaseModel):
    name: str
    account_id: int
    sale_id: int | None = None
    opportunity_id: int | None = None
    manager_id: int | None = None
    status: str = "planning"
    start_date: date | None = None
    end_date: date | None = None
    percent_complete: float = 0
    health: str = "green"


class ActivityIn(BaseModel):
    type: str = "task"
    subject: str
    description: str | None = None
    due_date: datetime | None = None
    is_done: bool = False
    owner_id: int | None = None
    account_id: int | None = None
    contact_id: int | None = None
    opportunity_id: int | None = None
    project_id: int | None = None


class ProductIn(BaseModel):
    name: str
    category: str | None = None
    unit_price: float = 0
    currency: str = "USD"
    is_recurring: bool = False
    description: str | None = None
    is_active: bool = True


class UserIn(BaseModel):
    email: EmailStr
    full_name: str
    password: str | None = None
    role: str = "rep"
    manager_id: int | None = None
    language: str = "en"
    is_active: bool = True


class StageIn(BaseModel):
    name: str
    sort_order: int = 0
    probability: float = Field(10, ge=0, le=100)
    is_won: bool = False
    is_lost: bool = False
    requires_amount: bool = False


class TargetIn(BaseModel):
    user_id: int
    year: int
    quarter: int = Field(ge=1, le=4)
    target_amount: float = 0


class CurrencyRateIn(BaseModel):
    code: str
    rate_to_base: float = 1.0


class OrgSettingsIn(BaseModel):
    name: str | None = None
    base_currency: str | None = None
    stale_days: int | None = None
