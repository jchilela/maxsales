from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_write
from ..database import get_db
from ..models import Milestone, Organization, Project, Sale, User
from ..schemas import MilestoneIn, ProjectIn, SaleIn
from ..serializers import project_out, sale_out
from ..utils import diff_changes, log_audit, rates_map, to_base

router = APIRouter(prefix="/api", tags=["sales & projects"])


@router.get("/sales")
def list_sales(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    sales = (
        db.query(Sale).filter(Sale.org_id == user.org_id).order_by(Sale.created_at.desc()).all()
    )
    return [sale_out(s) for s in sales]


@router.get("/sales/summary")
def sales_summary(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    org = db.get(Organization, user.org_id)
    rates = rates_map(db, user.org_id)
    sales = db.query(Sale).filter(Sale.org_id == user.org_id).all()
    mrr = sum(to_base(s.mrr, s.currency, rates) for s in sales if s.billing_type == "recurring")
    total = sum(to_base(s.contract_value, s.currency, rates) for s in sales)
    return {
        "base_currency": org.base_currency,
        "mrr": round(mrr, 2),
        "arr": round(mrr * 12, 2),
        "total_contract_value": round(total, 2),
        "count": len(sales),
    }


@router.post("/sales", status_code=201)
def create_sale(payload: SaleIn, user: User = Depends(require_write), db: Session = Depends(get_db)):
    s = Sale(org_id=user.org_id, **payload.model_dump())
    db.add(s)
    db.flush()
    log_audit(db, user, "sale", s.id, "create", {"contract_value": {"old": None, "new": s.contract_value}})
    db.commit()
    return sale_out(s)


@router.put("/sales/{sale_id}")
def update_sale(sale_id: int, payload: SaleIn, user: User = Depends(require_write), db: Session = Depends(get_db)):
    s = db.get(Sale, sale_id)
    if not s or s.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Sale not found")
    data = payload.model_dump()
    changes = diff_changes(s, data)
    for k, v in data.items():
        setattr(s, k, v)
    if changes:
        log_audit(db, user, "sale", s.id, "update", changes)
    db.commit()
    return sale_out(s)


@router.delete("/sales/{sale_id}", status_code=204)
def delete_sale(sale_id: int, user: User = Depends(require_write), db: Session = Depends(get_db)):
    s = db.get(Sale, sale_id)
    if not s or s.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Sale not found")
    log_audit(db, user, "sale", s.id, "delete", None)
    db.delete(s)
    db.commit()


# ---------------------------------------------------------------- projects


def _get_project(db: Session, user: User, project_id: int) -> Project:
    p = db.get(Project, project_id)
    if not p or p.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    return p


@router.get("/projects")
def list_projects(
    status: str | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    q = db.query(Project).filter(Project.org_id == user.org_id)
    if status:
        q = q.filter(Project.status == status)
    return [project_out(p) for p in q.order_by(Project.created_at.desc()).all()]


@router.get("/projects/{project_id}")
def get_project(project_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from ..models import Activity
    from ..serializers import activity_out

    p = _get_project(db, user, project_id)
    d = project_out(p, detail=True)
    activities = (
        db.query(Activity).filter(Activity.project_id == p.id).order_by(Activity.created_at.desc()).all()
    )
    d["activities"] = [activity_out(a) for a in activities]
    return d


@router.post("/projects", status_code=201)
def create_project(payload: ProjectIn, user: User = Depends(require_write), db: Session = Depends(get_db)):
    p = Project(org_id=user.org_id, **payload.model_dump())
    if p.manager_id is None:
        p.manager_id = user.id
    db.add(p)
    db.commit()
    return project_out(p, detail=True)


@router.put("/projects/{project_id}")
def update_project(
    project_id: int, payload: ProjectIn, user: User = Depends(require_write), db: Session = Depends(get_db)
):
    p = _get_project(db, user, project_id)
    for k, v in payload.model_dump().items():
        setattr(p, k, v)
    db.commit()
    return project_out(p, detail=True)


@router.put("/projects/{project_id}/milestones")
def set_milestones(
    project_id: int,
    items: list[MilestoneIn],
    user: User = Depends(require_write),
    db: Session = Depends(get_db),
):
    p = _get_project(db, user, project_id)
    p.milestones.clear()
    db.flush()
    for it in items:
        p.milestones.append(Milestone(name=it.name, due_date=it.due_date, is_done=it.is_done))
    db.commit()
    return project_out(p, detail=True)


@router.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: int, user: User = Depends(require_write), db: Session = Depends(get_db)):
    p = _get_project(db, user, project_id)
    db.delete(p)
    db.commit()
