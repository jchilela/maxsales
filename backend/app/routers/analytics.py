from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..auth import get_current_user, visible_user_ids
from ..database import get_db
from ..models import (
    Account,
    Activity,
    AuditLog,
    Contact,
    Opportunity,
    Organization,
    PipelineStage,
    Project,
    Sale,
    SalesTarget,
    User,
)
from ..serializers import activity_out, opportunity_out
from ..utils import csv_response, quarter_of, rates_map, to_base, utcnow

router = APIRouter(prefix="/api", tags=["dashboard, reports, search"])


def _scoped_opps(db: Session, user: User):
    q = db.query(Opportunity).filter(Opportunity.org_id == user.org_id)
    ids = visible_user_ids(db, user)
    if ids is not None:
        q = q.filter(or_(Opportunity.owner_id.in_(ids), Opportunity.owner_id.is_(None)))
    return q


@router.get("/dashboard")
def dashboard(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    org = db.get(Organization, user.org_id)
    rates = rates_map(db, user.org_id)
    today = date.today()
    quarter = quarter_of(today)

    opps = _scoped_opps(db, user).all()
    open_opps = [o for o in opps if o.status == "open"]
    closed = [o for o in opps if o.status in ("won", "lost")]
    won = [o for o in opps if o.status == "won"]

    stages = (
        db.query(PipelineStage)
        .filter(PipelineStage.org_id == user.org_id, ~PipelineStage.is_won, ~PipelineStage.is_lost)
        .order_by(PipelineStage.sort_order)
        .all()
    )
    pipeline_by_stage = []
    for s in stages:
        in_stage = [o for o in open_opps if o.stage_id == s.id]
        value = sum(to_base(o.amount, o.currency, rates) for o in in_stage)
        pipeline_by_stage.append(
            {"stage": s.name, "count": len(in_stage), "value": round(value, 2)}
        )

    weighted = sum(
        to_base(o.amount, o.currency, rates) * (o.probability or 0) / 100 for o in open_opps
    )
    win_rate = round(len(won) / len(closed) * 100, 1) if closed else None

    sales = db.query(Sale).filter(Sale.org_id == user.org_id).all()
    month_sales = sum(
        to_base(s.contract_value, s.currency, rates)
        for s in sales
        if s.start_date and s.start_date.year == today.year and s.start_date.month == today.month
    )
    quarter_sales_all = [
        s for s in sales
        if s.start_date and s.start_date.year == today.year and quarter_of(s.start_date) == quarter
    ]
    quarter_sales = sum(to_base(s.contract_value, s.currency, rates) for s in quarter_sales_all)
    mrr = sum(to_base(s.mrr, s.currency, rates) for s in sales if s.billing_type == "recurring")

    # quarterly target attainment: own target for reps, team/org totals otherwise
    tq = db.query(SalesTarget).filter(
        SalesTarget.org_id == user.org_id, SalesTarget.year == today.year, SalesTarget.quarter == quarter
    )
    ids = visible_user_ids(db, user)
    if ids is not None:
        tq = tq.filter(SalesTarget.user_id.in_(ids))
    target_amount = sum(t.target_amount for t in tq.all())

    overdue = (
        db.query(Activity)
        .filter(
            Activity.org_id == user.org_id,
            Activity.owner_id == user.id if user.role in ("rep", "manager") else True,
            ~Activity.is_done,
            Activity.due_date < utcnow(),
        )
        .order_by(Activity.due_date)
        .limit(10)
        .all()
    )

    top_open = sorted(open_opps, key=lambda o: to_base(o.amount, o.currency, rates), reverse=True)[:5]
    recently_closed = sorted(closed, key=lambda o: o.closed_at or o.created_at, reverse=True)[:5]
    stale_count = sum(1 for o in open_opps if opportunity_out(o, org.stale_days)["is_stale"])

    return {
        "base_currency": org.base_currency,
        "pipeline_by_stage": pipeline_by_stage,
        "pipeline_total": round(sum(x["value"] for x in pipeline_by_stage), 2),
        "weighted_forecast": round(weighted, 2),
        "win_rate": win_rate,
        "open_count": len(open_opps),
        "stale_count": stale_count,
        "sales_this_month": round(month_sales, 2),
        "sales_this_quarter": round(quarter_sales, 2),
        "quarter_target": round(target_amount, 2),
        "quarter_attainment": round(quarter_sales / target_amount * 100, 1) if target_amount else None,
        "mrr": round(mrr, 2),
        "arr": round(mrr * 12, 2),
        "top_open_opportunities": [opportunity_out(o, org.stale_days) for o in top_open],
        "recently_closed": [opportunity_out(o, org.stale_days) for o in recently_closed],
        "overdue_activities": [activity_out(a) for a in overdue],
    }


@router.get("/reports/sales")
def report_sales(
    group_by: str = "owner",
    format: str = "json",
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    org = db.get(Organization, user.org_id)
    rates = rates_map(db, user.org_id)
    won = _scoped_opps(db, user).filter(Opportunity.status == "won").all()

    def key_of(o: Opportunity) -> str:
        if group_by == "owner":
            return o.owner.full_name if o.owner else "Unassigned"
        if group_by == "product":
            return o.product_line or "Other"
        if group_by == "country":
            return (o.account.country if o.account else None) or "Unknown"
        if group_by == "quarter":
            d = o.closed_at.date() if o.closed_at else None
            return f"{d.year} Q{quarter_of(d)}" if d else "Unknown"
        return "All"

    buckets: dict[str, dict] = {}
    for o in won:
        k = key_of(o)
        b = buckets.setdefault(k, {"group": k, "deals": 0, "value": 0.0})
        b["deals"] += 1
        b["value"] += to_base(o.amount, o.currency, rates)
    rows = sorted(
        ({**b, "value": round(b["value"], 2)} for b in buckets.values()),
        key=lambda r: r["value"],
        reverse=True,
    )
    if format == "csv":
        return csv_response(rows, f"sales_by_{group_by}")
    return {"base_currency": org.base_currency, "group_by": group_by, "rows": rows}


@router.get("/reports/funnel")
def report_funnel(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Stage-by-stage funnel: how many opportunities ever reached each stage."""
    org = db.get(Organization, user.org_id)
    rates = rates_map(db, user.org_id)
    stages = (
        db.query(PipelineStage)
        .filter(PipelineStage.org_id == user.org_id, ~PipelineStage.is_won, ~PipelineStage.is_lost)
        .order_by(PipelineStage.sort_order)
        .all()
    )
    opps = _scoped_opps(db, user).all()
    reached: dict[int, set[int]] = {s.id: set() for s in stages}
    for o in opps:
        for h in o.stage_history:
            if h.to_stage_id in reached:
                reached[h.to_stage_id].add(o.id)
    won_ids = {o.id for o in opps if o.status == "won"}
    rows = []
    for i, s in enumerate(stages):
        count = len(reached[s.id])
        nxt = len(reached[stages[i + 1].id]) if i + 1 < len(stages) else len(won_ids)
        current = [o for o in opps if o.status == "open" and o.stage_id == s.id]
        rows.append(
            {
                "stage": s.name,
                "reached": count,
                "currently_open": len(current),
                "open_value": round(sum(to_base(o.amount, o.currency, rates) for o in current), 2),
                "conversion_to_next": round(nxt / count * 100, 1) if count else None,
            }
        )
    return {"base_currency": org.base_currency, "rows": rows}


@router.get("/reports/metrics")
def report_metrics(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    org = db.get(Organization, user.org_id)
    rates = rates_map(db, user.org_id)
    opps = _scoped_opps(db, user).all()
    won = [o for o in opps if o.status == "won"]
    closed = [o for o in opps if o.status in ("won", "lost")]
    avg_deal = (
        sum(to_base(o.amount, o.currency, rates) for o in won) / len(won) if won else 0
    )
    cycles = [
        (o.closed_at - o.created_at).days
        for o in closed
        if o.closed_at and o.created_at
    ]
    return {
        "base_currency": org.base_currency,
        "avg_deal_size": round(avg_deal, 2),
        "avg_sales_cycle_days": round(sum(cycles) / len(cycles), 1) if cycles else None,
        "win_rate": round(len(won) / len(closed) * 100, 1) if closed else None,
        "won_deals": len(won),
        "lost_deals": len(closed) - len(won),
    }


@router.get("/reports/loss-reasons")
def report_loss_reasons(
    format: str = "json", user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    lost = _scoped_opps(db, user).filter(Opportunity.status == "lost").all()
    buckets: dict[str, int] = {}
    for o in lost:
        buckets[o.loss_reason or "Unspecified"] = buckets.get(o.loss_reason or "Unspecified", 0) + 1
    rows = [
        {"reason": k, "count": v}
        for k, v in sorted(buckets.items(), key=lambda kv: kv[1], reverse=True)
    ]
    if format == "csv":
        return csv_response(rows, "loss_reasons")
    return {"rows": rows}


@router.get("/search")
def global_search(q: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    like = f"%{q}%"
    accounts = (
        db.query(Account)
        .filter(Account.org_id == user.org_id, Account.name.ilike(like))
        .limit(5)
        .all()
    )
    contacts = (
        db.query(Contact)
        .filter(Contact.org_id == user.org_id, or_(Contact.name.ilike(like), Contact.email.ilike(like)))
        .limit(5)
        .all()
    )
    opps = (
        db.query(Opportunity)
        .filter(Opportunity.org_id == user.org_id, Opportunity.name.ilike(like))
        .limit(5)
        .all()
    )
    projects = (
        db.query(Project)
        .filter(Project.org_id == user.org_id, Project.name.ilike(like))
        .limit(5)
        .all()
    )
    return {
        "accounts": [{"id": a.id, "name": a.name, "country": a.country} for a in accounts],
        "contacts": [
            {"id": c.id, "name": c.name, "email": c.email, "account_id": c.account_id}
            for c in contacts
        ],
        "opportunities": [
            {"id": o.id, "name": o.name, "amount": o.amount, "currency": o.currency}
            for o in opps
        ],
        "projects": [{"id": p.id, "name": p.name, "status": p.status} for p in projects],
    }


@router.get("/audit")
def audit_trail(
    entity_type: str,
    entity_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(AuditLog)
        .filter(
            AuditLog.org_id == user.org_id,
            AuditLog.entity_type == entity_type,
            AuditLog.entity_id == entity_id,
        )
        .order_by(AuditLog.created_at.desc())
        .limit(100)
        .all()
    )
    return [
        {
            "id": r.id,
            "action": r.action,
            "changes": r.changes,
            "user": r.user.full_name if r.user else None,
            "at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]
