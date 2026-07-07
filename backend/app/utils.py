import csv
import io
from datetime import date, datetime, timezone

from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from .models import AuditLog, CurrencyRate, User


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def rates_map(db: Session, org_id: int) -> dict[str, float]:
    rows = db.query(CurrencyRate).filter(CurrencyRate.org_id == org_id).all()
    return {r.code: r.rate_to_base for r in rows}


def to_base(amount: float | None, currency: str | None, rates: dict[str, float]) -> float:
    """Convert an amount into the org base currency for rollups."""
    if not amount:
        return 0.0
    return amount * rates.get(currency or "", 1.0)


def log_audit(
    db: Session,
    user: User,
    entity_type: str,
    entity_id: int,
    action: str,
    changes: dict | None = None,
):
    db.add(
        AuditLog(
            org_id=user.org_id,
            entity_type=entity_type,
            entity_id=entity_id,
            user_id=user.id,
            action=action,
            changes=changes,
        )
    )


def diff_changes(obj, payload: dict) -> dict:
    """Build an audit diff of fields that actually change."""
    out = {}
    for field, new in payload.items():
        old = getattr(obj, field, None)
        if isinstance(old, (date, datetime)):
            old = old.isoformat()
        if isinstance(new, (date, datetime)):
            new = new.isoformat()
        if old != new:
            out[field] = {"old": old, "new": new}
    return out


def quarter_of(d: date) -> int:
    return (d.month - 1) // 3 + 1


def csv_response(rows: list[dict], filename: str) -> StreamingResponse:
    buf = io.StringIO()
    if rows:
        writer = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}.csv"'},
    )
