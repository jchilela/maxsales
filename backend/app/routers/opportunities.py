from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_write, visible_user_ids
from ..database import get_db
from ..models import (
    Account,
    Activity,
    Opportunity,
    OpportunityLineItem,
    Organization,
    PipelineStage,
    Project,
    Sale,
    StageHistory,
    User,
)
from ..schemas import LineItemIn, OpportunityIn, StageChangeIn, StageIn
from ..serializers import activity_out, line_item_out, opportunity_out
from ..utils import diff_changes, log_audit, utcnow

router = APIRouter(prefix="/api", tags=["opportunities & pipeline"])


def _get_opp(db: Session, user: User, opp_id: int) -> Opportunity:
    o = db.get(Opportunity, opp_id)
    if not o or o.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    return o


def _get_stage(db: Session, user: User, stage_id: int) -> PipelineStage:
    s = db.get(PipelineStage, stage_id)
    if not s or s.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Stage not found")
    return s


def _apply_stage_rules(o: Opportunity, target: PipelineStage, payload: StageChangeIn):
    """Enforce advancement gates before a stage transition is accepted."""
    if target.requires_amount and (not o.amount or not o.expected_close_date):
        raise HTTPException(
            status_code=422,
            detail=f'Amount and expected close date are required to enter "{target.name}".',
        )
    if target.is_lost and not (payload.loss_reason or o.loss_reason):
        raise HTTPException(status_code=422, detail="A loss reason is required to close as Lost.")


@router.get("/opportunities")
def list_opportunities(
    owner_id: int | None = None,
    stage_id: int | None = None,
    account_id: int | None = None,
    status: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    org = db.get(Organization, user.org_id)
    q = db.query(Opportunity).filter(Opportunity.org_id == user.org_id)
    ids = visible_user_ids(db, user)
    if ids is not None:
        q = q.filter((Opportunity.owner_id.in_(ids)) | (Opportunity.owner_id.is_(None)))
    if owner_id:
        q = q.filter(Opportunity.owner_id == owner_id)
    if stage_id:
        q = q.filter(Opportunity.stage_id == stage_id)
    if account_id:
        q = q.filter(Opportunity.account_id == account_id)
    if status:
        q = q.filter(Opportunity.status == status)
    opps = q.order_by(Opportunity.expected_close_date.is_(None), Opportunity.expected_close_date).all()
    return [opportunity_out(o, org.stale_days) for o in opps]


@router.get("/opportunities/{opp_id}")
def get_opportunity(opp_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    o = _get_opp(db, user, opp_id)
    org = db.get(Organization, user.org_id)
    d = opportunity_out(o, org.stale_days, detail=True)
    activities = (
        db.query(Activity)
        .filter(Activity.opportunity_id == o.id)
        .order_by(Activity.created_at.desc())
        .all()
    )
    d["activities"] = [activity_out(a) for a in activities]
    return d


@router.post("/opportunities", status_code=201)
def create_opportunity(
    payload: OpportunityIn, user: User = Depends(require_write), db: Session = Depends(get_db)
):
    account = db.get(Account, payload.account_id)
    if not account or account.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Account not found")
    data = payload.model_dump()
    stage_id = data.pop("stage_id", None)
    if stage_id:
        stage = _get_stage(db, user, stage_id)
    else:
        stage = (
            db.query(PipelineStage)
            .filter(PipelineStage.org_id == user.org_id, ~PipelineStage.is_won, ~PipelineStage.is_lost)
            .order_by(PipelineStage.sort_order)
            .first()
        )
        if not stage:
            raise HTTPException(status_code=422, detail="No pipeline stages configured")
    probability = data.pop("probability", None)
    o = Opportunity(
        org_id=user.org_id,
        stage_id=stage.id,
        probability=probability if probability is not None else stage.probability,
        stage_entered_at=utcnow(),
        **data,
    )
    if o.owner_id is None:
        o.owner_id = user.id
    db.add(o)
    db.flush()
    db.add(StageHistory(opportunity_id=o.id, from_stage_id=None, to_stage_id=stage.id, changed_by_id=user.id))
    log_audit(db, user, "opportunity", o.id, "create", {"name": {"old": None, "new": o.name}})
    db.commit()
    org = db.get(Organization, user.org_id)
    return opportunity_out(o, org.stale_days, detail=True)


@router.put("/opportunities/{opp_id}")
def update_opportunity(
    opp_id: int, payload: OpportunityIn, user: User = Depends(require_write), db: Session = Depends(get_db)
):
    o = _get_opp(db, user, opp_id)
    data = payload.model_dump(exclude_unset=True)
    data.pop("stage_id", None)  # stage moves go through /stage to enforce rules
    changes = diff_changes(o, data)
    for k, v in data.items():
        setattr(o, k, v)
    if changes:
        log_audit(db, user, "opportunity", o.id, "update", changes)
    db.commit()
    org = db.get(Organization, user.org_id)
    return opportunity_out(o, org.stale_days, detail=True)


@router.post("/opportunities/{opp_id}/stage")
def change_stage(
    opp_id: int, payload: StageChangeIn, user: User = Depends(require_write), db: Session = Depends(get_db)
):
    o = _get_opp(db, user, opp_id)
    target = _get_stage(db, user, payload.stage_id)
    if target.id == o.stage_id:
        org = db.get(Organization, user.org_id)
        return opportunity_out(o, org.stale_days, detail=True)
    _apply_stage_rules(o, target, payload)

    old_stage = o.stage
    db.add(
        StageHistory(
            opportunity_id=o.id, from_stage_id=o.stage_id, to_stage_id=target.id, changed_by_id=user.id
        )
    )
    o.stage_id = target.id
    o.stage_entered_at = utcnow()
    o.probability = target.probability
    created = {}

    if target.is_lost:
        o.status = "lost"
        o.closed_at = utcnow()
        o.loss_reason = payload.loss_reason or o.loss_reason
    elif target.is_won:
        o.status = "won"
        o.closed_at = utcnow()
        o.probability = 100
        existing = db.query(Sale).filter(Sale.opportunity_id == o.id).first()
        if not existing:
            recurring = any(li.product and li.product.is_recurring for li in o.line_items)
            amount = o.amount or sum(li.total for li in o.line_items)
            sale = Sale(
                org_id=user.org_id,
                opportunity_id=o.id,
                account_id=o.account_id,
                contract_value=amount,
                currency=o.currency,
                billing_type="recurring" if recurring else "one_off",
                mrr=round(amount / 12, 2) if recurring else None,
                start_date=o.expected_close_date,
                term_months=12 if recurring else None,
            )
            db.add(sale)
            db.flush()
            created["sale_id"] = sale.id
            log_audit(db, user, "sale", sale.id, "create", {"contract_value": {"old": None, "new": amount}})
            if payload.create_project:
                project = Project(
                    org_id=user.org_id,
                    name=f"{o.name} — Delivery",
                    account_id=o.account_id,
                    sale_id=sale.id,
                    opportunity_id=o.id,
                    manager_id=o.owner_id,
                    status="planning",
                    start_date=o.expected_close_date,
                )
                db.add(project)
                db.flush()
                created["project_id"] = project.id
        # account becomes active on first win
        if o.account and o.account.status == "prospect":
            o.account.status = "active"
    else:
        o.status = "open"
        o.closed_at = None

    log_audit(
        db, user, "opportunity", o.id, "stage_change",
        {"stage": {"old": old_stage.name if old_stage else None, "new": target.name}},
    )
    db.commit()
    org = db.get(Organization, user.org_id)
    out = opportunity_out(o, org.stale_days, detail=True)
    out["created"] = created
    return out


@router.put("/opportunities/{opp_id}/line-items")
def set_line_items(
    opp_id: int, items: list[LineItemIn], user: User = Depends(require_write), db: Session = Depends(get_db)
):
    o = _get_opp(db, user, opp_id)
    o.line_items.clear()
    db.flush()
    for it in items:
        o.line_items.append(OpportunityLineItem(**it.model_dump()))
    db.flush()
    o.amount = round(sum(li.total for li in o.line_items), 2) or o.amount
    log_audit(db, user, "opportunity", o.id, "update", {"line_items": {"old": None, "new": len(items)}})
    db.commit()
    return [line_item_out(li) for li in o.line_items]


@router.delete("/opportunities/{opp_id}", status_code=204)
def delete_opportunity(opp_id: int, user: User = Depends(require_write), db: Session = Depends(get_db)):
    o = _get_opp(db, user, opp_id)
    log_audit(db, user, "opportunity", o.id, "delete", {"name": {"old": o.name, "new": None}})
    db.delete(o)
    db.commit()


# ---------------------------------------------------------------- stages


@router.get("/stages")
def list_stages(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    stages = (
        db.query(PipelineStage)
        .filter(PipelineStage.org_id == user.org_id)
        .order_by(PipelineStage.sort_order)
        .all()
    )
    return [
        {
            "id": s.id,
            "name": s.name,
            "sort_order": s.sort_order,
            "probability": s.probability,
            "is_won": s.is_won,
            "is_lost": s.is_lost,
            "requires_amount": s.requires_amount,
        }
        for s in stages
    ]


@router.post("/stages", status_code=201)
def create_stage(payload: StageIn, user: User = Depends(require_write), db: Session = Depends(get_db)):
    s = PipelineStage(org_id=user.org_id, **payload.model_dump())
    db.add(s)
    db.commit()
    return {"id": s.id}


@router.put("/stages/{stage_id}")
def update_stage(stage_id: int, payload: StageIn, user: User = Depends(require_write), db: Session = Depends(get_db)):
    s = _get_stage(db, user, stage_id)
    for k, v in payload.model_dump().items():
        setattr(s, k, v)
    db.commit()
    return {"id": s.id}


@router.delete("/stages/{stage_id}", status_code=204)
def delete_stage(stage_id: int, user: User = Depends(require_write), db: Session = Depends(get_db)):
    s = _get_stage(db, user, stage_id)
    in_use = db.query(Opportunity).filter(Opportunity.stage_id == s.id).count()
    if in_use:
        raise HTTPException(status_code=409, detail=f"Stage has {in_use} opportunities; move them first.")
    db.delete(s)
    db.commit()
