from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_write, visible_user_ids
from ..database import get_db
from ..models import Account, Activity, Contact, Opportunity, Organization, Project, Sale, User
from ..schemas import AccountIn, ContactIn
from ..serializers import (
    account_out,
    activity_out,
    contact_out,
    opportunity_out,
    project_out,
    sale_out,
)
from ..utils import rates_map, to_base

router = APIRouter(prefix="/api", tags=["accounts & contacts"])


def _scoped_accounts(db: Session, user: User):
    q = db.query(Account).filter(Account.org_id == user.org_id)
    ids = visible_user_ids(db, user)
    if ids is not None:
        # unowned accounts are shared with everyone
        q = q.filter((Account.owner_id.in_(ids)) | (Account.owner_id.is_(None)))
    return q


def _get_account(db: Session, user: User, account_id: int) -> Account:
    a = db.get(Account, account_id)
    if not a or a.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Account not found")
    return a


@router.get("/accounts")
def list_accounts(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    accounts = _scoped_accounts(db, user).order_by(Account.name).all()
    out = []
    for a in accounts:
        d = account_out(a)
        d["contact_count"] = len(a.contacts)
        d["open_opportunities"] = sum(1 for o in a.opportunities if o.status == "open")
        out.append(d)
    return out


@router.post("/accounts", status_code=201)
def create_account(
    payload: AccountIn,
    force: bool = Query(False, description="Skip duplicate-name check"),
    user: User = Depends(require_write),
    db: Session = Depends(get_db),
):
    if not force:
        dup = (
            db.query(Account)
            .filter(Account.org_id == user.org_id, Account.name.ilike(payload.name.strip()))
            .first()
        )
        if dup:
            raise HTTPException(
                status_code=409,
                detail=f'Possible duplicate: account "{dup.name}" already exists (id {dup.id}). '
                "Retry with ?force=true to create anyway.",
            )
    a = Account(org_id=user.org_id, **payload.model_dump())
    if a.owner_id is None:
        a.owner_id = user.id
    db.add(a)
    db.commit()
    return account_out(a)


@router.get("/accounts/{account_id}")
def account_360(account_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    a = _get_account(db, user, account_id)
    org = db.get(Organization, user.org_id)
    rates = rates_map(db, user.org_id)
    sales = db.query(Sale).filter(Sale.account_id == a.id).all()
    activities = (
        db.query(Activity)
        .filter(Activity.account_id == a.id)
        .order_by(Activity.created_at.desc())
        .limit(100)
        .all()
    )
    lifetime = sum(to_base(s.contract_value, s.currency, rates) for s in sales)
    d = account_out(a)
    d.update(
        {
            "contacts": [contact_out(c) for c in a.contacts],
            "opportunities": [opportunity_out(o, org.stale_days) for o in a.opportunities],
            "projects": [project_out(p) for p in a.projects],
            "sales": [sale_out(s) for s in sales],
            "activities": [activity_out(x) for x in activities],
            "lifetime_revenue": round(lifetime, 2),
            "base_currency": org.base_currency,
        }
    )
    return d


@router.put("/accounts/{account_id}")
def update_account(
    account_id: int, payload: AccountIn, user: User = Depends(require_write), db: Session = Depends(get_db)
):
    a = _get_account(db, user, account_id)
    for k, v in payload.model_dump().items():
        setattr(a, k, v)
    db.commit()
    return account_out(a)


@router.delete("/accounts/{account_id}", status_code=204)
def delete_account(account_id: int, user: User = Depends(require_write), db: Session = Depends(get_db)):
    a = _get_account(db, user, account_id)
    db.delete(a)
    db.commit()


# ---------------------------------------------------------------- contacts


@router.get("/contacts")
def list_contacts(
    account_id: int | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Contact).filter(Contact.org_id == user.org_id)
    if account_id:
        q = q.filter(Contact.account_id == account_id)
    return [contact_out(c) for c in q.order_by(Contact.name).all()]


@router.get("/contacts/{contact_id}")
def get_contact(contact_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    c = db.get(Contact, contact_id)
    if not c or c.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Contact not found")
    d = contact_out(c)
    activities = (
        db.query(Activity)
        .filter(Activity.contact_id == c.id)
        .order_by(Activity.created_at.desc())
        .all()
    )
    d["activities"] = [activity_out(a) for a in activities]
    return d


@router.post("/contacts", status_code=201)
def create_contact(
    payload: ContactIn,
    force: bool = Query(False, description="Skip duplicate-email check"),
    user: User = Depends(require_write),
    db: Session = Depends(get_db),
):
    _get_account(db, user, payload.account_id)
    if payload.email and not force:
        dup = (
            db.query(Contact)
            .filter(Contact.org_id == user.org_id, Contact.email.ilike(payload.email.strip()))
            .first()
        )
        if dup:
            raise HTTPException(
                status_code=409,
                detail=f'Possible duplicate: contact "{dup.name}" already uses this email (id {dup.id}). '
                "Retry with ?force=true to create anyway.",
            )
    c = Contact(org_id=user.org_id, **payload.model_dump())
    db.add(c)
    db.commit()
    return contact_out(c)


@router.put("/contacts/{contact_id}")
def update_contact(
    contact_id: int, payload: ContactIn, user: User = Depends(require_write), db: Session = Depends(get_db)
):
    c = db.get(Contact, contact_id)
    if not c or c.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Contact not found")
    for k, v in payload.model_dump().items():
        setattr(c, k, v)
    db.commit()
    return contact_out(c)


@router.delete("/contacts/{contact_id}", status_code=204)
def delete_contact(contact_id: int, user: User = Depends(require_write), db: Session = Depends(get_db)):
    c = db.get(Contact, contact_id)
    if not c or c.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Contact not found")
    db.delete(c)
    db.commit()
