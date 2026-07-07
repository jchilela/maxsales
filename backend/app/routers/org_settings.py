from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_admin
from ..database import get_db
from ..models import CurrencyRate, Organization, SalesTarget, User
from ..schemas import CurrencyRateIn, OrgSettingsIn, TargetIn

router = APIRouter(prefix="/api", tags=["settings"])


@router.get("/org")
def get_org(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    org = db.get(Organization, user.org_id)
    return {
        "id": org.id,
        "name": org.name,
        "base_currency": org.base_currency,
        "stale_days": org.stale_days,
    }


@router.put("/org")
def update_org(payload: OrgSettingsIn, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    org = db.get(Organization, admin.org_id)
    for k, v in payload.model_dump(exclude_unset=True).items():
        if v is not None:
            setattr(org, k, v)
    db.commit()
    return get_org(admin, db)


@router.get("/currencies")
def list_currencies(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(CurrencyRate).filter(CurrencyRate.org_id == user.org_id).all()
    return [{"id": r.id, "code": r.code, "rate_to_base": r.rate_to_base} for r in rows]


@router.put("/currencies")
def set_currencies(
    items: list[CurrencyRateIn], admin: User = Depends(require_admin), db: Session = Depends(get_db)
):
    db.query(CurrencyRate).filter(CurrencyRate.org_id == admin.org_id).delete()
    for it in items:
        db.add(CurrencyRate(org_id=admin.org_id, code=it.code.upper(), rate_to_base=it.rate_to_base))
    db.commit()
    return list_currencies(admin, db)


@router.get("/targets")
def list_targets(
    year: int | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    q = db.query(SalesTarget).filter(SalesTarget.org_id == user.org_id)
    if year:
        q = q.filter(SalesTarget.year == year)
    return [
        {
            "id": t.id,
            "user_id": t.user_id,
            "user_name": t.user.full_name if t.user else None,
            "year": t.year,
            "quarter": t.quarter,
            "target_amount": t.target_amount,
        }
        for t in q.order_by(SalesTarget.year, SalesTarget.quarter).all()
    ]


@router.post("/targets", status_code=201)
def upsert_target(payload: TargetIn, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    t = (
        db.query(SalesTarget)
        .filter(
            SalesTarget.org_id == admin.org_id,
            SalesTarget.user_id == payload.user_id,
            SalesTarget.year == payload.year,
            SalesTarget.quarter == payload.quarter,
        )
        .first()
    )
    if t:
        t.target_amount = payload.target_amount
    else:
        t = SalesTarget(org_id=admin.org_id, **payload.model_dump())
        db.add(t)
    db.commit()
    return {"id": t.id}


@router.delete("/targets/{target_id}", status_code=204)
def delete_target(target_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    t = db.get(SalesTarget, target_id)
    if not t or t.org_id != admin.org_id:
        raise HTTPException(status_code=404, detail="Target not found")
    db.delete(t)
    db.commit()
