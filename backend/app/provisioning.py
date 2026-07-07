"""Self-service tenant provisioning: every new company gets a default
pipeline and currency table so it is usable immediately."""
from sqlalchemy.orm import Session

from .models import CurrencyRate, Membership, Organization, PipelineStage, User

DEFAULT_STAGES = [
    # name, order, probability, is_won, is_lost, requires_amount
    ("Lead", 1, 10, False, False, False),
    ("Qualified", 2, 25, False, False, False),
    ("Proposal Sent", 3, 50, False, False, True),
    ("Negotiation", 4, 70, False, False, True),
    ("Contract", 5, 90, False, False, True),
    ("Closed Won", 6, 100, True, False, False),
    ("Closed Lost", 7, 0, False, True, False),
]

# rate_to_base seeds assume a USD base; admins adjust in Settings → Currencies
DEFAULT_RATES = {"USD": 1.0, "EUR": 1.09, "AOA": 0.0011}


def create_default_stages(db: Session, org_id: int) -> dict[str, PipelineStage]:
    out = {}
    for name, order, prob, won, lost, req in DEFAULT_STAGES:
        s = PipelineStage(
            org_id=org_id, name=name, sort_order=order, probability=prob,
            is_won=won, is_lost=lost, requires_amount=req,
        )
        db.add(s)
        db.flush()
        out[name] = s
    return out


def create_default_currencies(db: Session, org_id: int, base_currency: str) -> None:
    codes = dict(DEFAULT_RATES)
    codes[base_currency] = 1.0
    if base_currency != "USD" and "USD" in codes:
        # only the base is guaranteed correct; others are placeholders to edit
        codes["USD"] = 1.0 if base_currency == "USD" else codes.get("USD", 1.0)
    for code, rate in codes.items():
        db.add(CurrencyRate(org_id=org_id, code=code, rate_to_base=rate))


def provision_company(db: Session, name: str, base_currency: str, owner: User) -> Organization:
    """Create a company with defaults and make `owner` its admin."""
    org = Organization(name=name, base_currency=base_currency.upper()[:3] or "USD", stale_days=14)
    db.add(org)
    db.flush()
    create_default_stages(db, org.id)
    create_default_currencies(db, org.id, org.base_currency)
    db.add(Membership(user_id=owner.id, org_id=org.id, role="admin", is_owner=True))
    return org
