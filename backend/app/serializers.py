"""Dict serializers that enrich records with display names and computed
fields (stale flag, days in stage, totals) for the UI."""
from datetime import datetime, timezone

from .models import Account, Activity, Contact, Opportunity, Project, Sale, User


def _iso(v):
    return v.isoformat() if v else None


def _days_since(dt) -> int | None:
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return max(0, (datetime.now(timezone.utc) - dt).days)


def user_out(u: User | None, membership=None) -> dict | None:
    """Role/manager are per-company (membership); falls back to the transient
    attrs get_current_user attaches for the active company."""
    if not u:
        return None
    m = membership or getattr(u, "membership", None)
    return {
        "id": u.id,
        "email": u.email,
        "full_name": u.full_name,
        "role": m.role if m else None,
        "manager_id": m.manager_id if m else None,
        "is_owner": m.is_owner if m else False,
        "language": u.language,
        "is_active": u.is_active,
    }


def account_out(a: Account) -> dict:
    return {
        "id": a.id,
        "name": a.name,
        "industry": a.industry,
        "segment": a.segment,
        "country": a.country,
        "website": a.website,
        "tax_id": a.tax_id,
        "owner_id": a.owner_id,
        "owner_name": a.owner.full_name if a.owner else None,
        "status": a.status,
        "annual_revenue": a.annual_revenue,
        "notes": a.notes,
        "created_at": _iso(a.created_at),
    }


def contact_out(c: Contact) -> dict:
    return {
        "id": c.id,
        "account_id": c.account_id,
        "account_name": c.account.name if c.account else None,
        "name": c.name,
        "role_title": c.role_title,
        "email": c.email,
        "phone": c.phone,
        "whatsapp": c.whatsapp,
        "linkedin": c.linkedin,
        "is_decision_maker": c.is_decision_maker,
        "preferred_language": c.preferred_language,
    }


def line_item_out(li) -> dict:
    return {
        "id": li.id,
        "product_id": li.product_id,
        "product_name": li.product.name if li.product else None,
        "quantity": li.quantity,
        "unit_price": li.unit_price,
        "discount_pct": li.discount_pct,
        "total": li.total,
    }


def opportunity_out(o: Opportunity, stale_days: int = 14, detail: bool = False) -> dict:
    last_touch = o.last_activity_at or o.created_at
    is_stale = o.status == "open" and (_days_since(last_touch) or 0) >= stale_days
    data = {
        "id": o.id,
        "name": o.name,
        "account_id": o.account_id,
        "account_name": o.account.name if o.account else None,
        "primary_contact_id": o.primary_contact_id,
        "primary_contact_name": o.primary_contact.name if o.primary_contact else None,
        "owner_id": o.owner_id,
        "owner_name": o.owner.full_name if o.owner else None,
        "amount": o.amount,
        "currency": o.currency,
        "probability": o.probability,
        "weighted_amount": round((o.amount or 0) * (o.probability or 0) / 100, 2),
        "expected_close_date": _iso(o.expected_close_date),
        "source": o.source,
        "product_line": o.product_line,
        "competitors": o.competitors,
        "next_step": o.next_step,
        "stage_id": o.stage_id,
        "stage_name": o.stage.name if o.stage else None,
        "status": o.status,
        "loss_reason": o.loss_reason,
        "days_in_stage": _days_since(o.stage_entered_at),
        "last_activity_at": _iso(o.last_activity_at),
        "is_stale": is_stale,
        "closed_at": _iso(o.closed_at),
        "created_at": _iso(o.created_at),
    }
    if detail:
        data["line_items"] = [line_item_out(li) for li in o.line_items]
        data["stage_history"] = [
            {
                "from_stage": h.from_stage.name if h.from_stage else None,
                "to_stage": h.to_stage.name if h.to_stage else None,
                "changed_by": h.changed_by.full_name if h.changed_by else None,
                "changed_at": _iso(h.changed_at),
            }
            for h in o.stage_history
        ]
    return data


def sale_out(s: Sale) -> dict:
    mrr = s.mrr if s.billing_type == "recurring" else None
    return {
        "id": s.id,
        "opportunity_id": s.opportunity_id,
        "opportunity_name": s.opportunity.name if s.opportunity else None,
        "account_id": s.account_id,
        "account_name": s.account.name if s.account else None,
        "contract_value": s.contract_value,
        "currency": s.currency,
        "billing_type": s.billing_type,
        "mrr": mrr,
        "arr": round(mrr * 12, 2) if mrr else None,
        "start_date": _iso(s.start_date),
        "term_months": s.term_months,
        "invoicing_status": s.invoicing_status,
        "created_at": _iso(s.created_at),
    }


def project_out(p: Project, detail: bool = False) -> dict:
    data = {
        "id": p.id,
        "name": p.name,
        "account_id": p.account_id,
        "account_name": p.account.name if p.account else None,
        "sale_id": p.sale_id,
        "opportunity_id": p.opportunity_id,
        "manager_id": p.manager_id,
        "manager_name": p.manager.full_name if p.manager else None,
        "status": p.status,
        "start_date": _iso(p.start_date),
        "end_date": _iso(p.end_date),
        "percent_complete": p.percent_complete,
        "health": p.health,
        "milestone_count": len(p.milestones),
        "milestones_done": sum(1 for m in p.milestones if m.is_done),
    }
    if detail:
        data["milestones"] = [
            {"id": m.id, "name": m.name, "due_date": _iso(m.due_date), "is_done": m.is_done}
            for m in p.milestones
        ]
    return data


def activity_out(a: Activity) -> dict:
    related_type, related_id, related_name = None, None, None
    if a.opportunity_id:
        related_type, related_id = "opportunity", a.opportunity_id
        related_name = a.opportunity.name if a.opportunity else None
    elif a.project_id:
        related_type, related_id = "project", a.project_id
        related_name = a.project.name if a.project else None
    elif a.contact_id:
        related_type, related_id = "contact", a.contact_id
        related_name = a.contact.name if a.contact else None
    elif a.account_id:
        related_type, related_id = "account", a.account_id
        related_name = a.account.name if a.account else None
    return {
        "id": a.id,
        "type": a.type,
        "subject": a.subject,
        "description": a.description,
        "due_date": _iso(a.due_date),
        "is_done": a.is_done,
        "owner_id": a.owner_id,
        "owner_name": a.owner.full_name if a.owner else None,
        "account_id": a.account_id,
        "contact_id": a.contact_id,
        "opportunity_id": a.opportunity_id,
        "project_id": a.project_id,
        "related_type": related_type,
        "related_id": related_id,
        "related_name": related_name,
        "created_at": _iso(a.created_at),
    }
