from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_write
from ..database import get_db
from ..models import Activity, Opportunity, Product, User
from ..schemas import ActivityIn, ProductIn
from ..serializers import activity_out
from ..utils import utcnow

router = APIRouter(prefix="/api", tags=["activities & products"])


def _touch_opportunity(db: Session, activity: Activity):
    """Keep last_activity_at fresh so stale-deal detection works."""
    if activity.opportunity_id:
        opp = db.get(Opportunity, activity.opportunity_id)
        if opp:
            opp.last_activity_at = utcnow()


@router.get("/activities")
def list_activities(
    account_id: int | None = None,
    contact_id: int | None = None,
    opportunity_id: int | None = None,
    project_id: int | None = None,
    overdue: bool = False,
    open_only: bool = False,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Activity).filter(Activity.org_id == user.org_id)
    if account_id:
        q = q.filter(Activity.account_id == account_id)
    if contact_id:
        q = q.filter(Activity.contact_id == contact_id)
    if opportunity_id:
        q = q.filter(Activity.opportunity_id == opportunity_id)
    if project_id:
        q = q.filter(Activity.project_id == project_id)
    if overdue:
        q = q.filter(~Activity.is_done, Activity.due_date < utcnow())
    if open_only:
        q = q.filter(~Activity.is_done)
    return [activity_out(a) for a in q.order_by(Activity.created_at.desc()).limit(500).all()]


@router.post("/activities", status_code=201)
def create_activity(payload: ActivityIn, user: User = Depends(require_write), db: Session = Depends(get_db)):
    a = Activity(org_id=user.org_id, **payload.model_dump())
    if a.owner_id is None:
        a.owner_id = user.id
    db.add(a)
    _touch_opportunity(db, a)
    db.commit()
    return activity_out(a)


@router.put("/activities/{activity_id}")
def update_activity(
    activity_id: int, payload: ActivityIn, user: User = Depends(require_write), db: Session = Depends(get_db)
):
    a = db.get(Activity, activity_id)
    if not a or a.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Activity not found")
    for k, v in payload.model_dump().items():
        setattr(a, k, v)
    db.commit()
    return activity_out(a)


@router.delete("/activities/{activity_id}", status_code=204)
def delete_activity(activity_id: int, user: User = Depends(require_write), db: Session = Depends(get_db)):
    a = db.get(Activity, activity_id)
    if not a or a.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Activity not found")
    db.delete(a)
    db.commit()


# ---------------------------------------------------------------- products


@router.get("/products")
def list_products(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    products = db.query(Product).filter(Product.org_id == user.org_id).order_by(Product.name).all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "category": p.category,
            "unit_price": p.unit_price,
            "currency": p.currency,
            "is_recurring": p.is_recurring,
            "description": p.description,
            "is_active": p.is_active,
        }
        for p in products
    ]


@router.post("/products", status_code=201)
def create_product(payload: ProductIn, user: User = Depends(require_write), db: Session = Depends(get_db)):
    p = Product(org_id=user.org_id, **payload.model_dump())
    db.add(p)
    db.commit()
    return {"id": p.id}


@router.put("/products/{product_id}")
def update_product(
    product_id: int, payload: ProductIn, user: User = Depends(require_write), db: Session = Depends(get_db)
):
    p = db.get(Product, product_id)
    if not p or p.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Product not found")
    for k, v in payload.model_dump().items():
        setattr(p, k, v)
    db.commit()
    return {"id": p.id}


@router.delete("/products/{product_id}", status_code=204)
def delete_product(product_id: int, user: User = Depends(require_write), db: Session = Depends(get_db)):
    p = db.get(Product, product_id)
    if not p or p.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Product not found")
    p.is_active = False  # soft delete: line items may reference it
    db.commit()
