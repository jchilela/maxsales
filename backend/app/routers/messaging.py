"""Outbound messaging: WhatsApp and email follow-ups from the portal.

Two delivery modes per channel, chosen automatically:
- Direct API mode when credentials are configured in the environment
  (WHATSAPP_TOKEN + WHATSAPP_PHONE_ID for Meta's Cloud API; SMTP_* for email).
- Link mode otherwise: the endpoint returns a wa.me / mailto: link with the
  message pre-filled; the browser opens it and the user sends from their own
  WhatsApp (their number) or mail client with one click.

Either way the message is logged as an activity on the related record, so the
timeline shows the follow-up history.
"""
import json
import os
import re
import smtplib
import urllib.parse
import urllib.request
from email.message import EmailMessage

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import require_write
from ..database import get_db
from ..models import Activity, Contact, User
from ..serializers import activity_out
from .activities_products import _touch_opportunity

router = APIRouter(prefix="/api/messages", tags=["messaging"])


class MessageIn(BaseModel):
    contact_id: int | None = None
    to: str | None = None  # phone (whatsapp) or email address override
    subject: str | None = None  # email only
    message: str
    account_id: int | None = None
    opportunity_id: int | None = None
    project_id: int | None = None


def _get_contact(db: Session, user: User, contact_id: int | None) -> Contact | None:
    if not contact_id:
        return None
    c = db.get(Contact, contact_id)
    if not c or c.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Contact not found")
    return c


def _log(db: Session, user: User, payload: MessageIn, contact: Contact | None,
         type_: str, subject: str) -> Activity:
    a = Activity(
        org_id=user.org_id,
        type=type_,
        subject=subject,
        description=payload.message,
        is_done=True,
        owner_id=user.id,
        account_id=payload.account_id or (contact.account_id if contact else None),
        contact_id=contact.id if contact else None,
        opportunity_id=payload.opportunity_id,
        project_id=payload.project_id,
    )
    db.add(a)
    _touch_opportunity(db, a)
    db.commit()
    return a


@router.post("/whatsapp")
def send_whatsapp(payload: MessageIn, user: User = Depends(require_write), db: Session = Depends(get_db)):
    contact = _get_contact(db, user, payload.contact_id)
    raw = payload.to or (contact.whatsapp or contact.phone if contact else None)
    digits = re.sub(r"\D", "", raw or "")
    if not digits:
        raise HTTPException(status_code=422, detail="No WhatsApp number for this recipient")
    if not payload.message.strip():
        raise HTTPException(status_code=422, detail="Message is empty")

    token = os.getenv("WHATSAPP_TOKEN")
    phone_id = os.getenv("WHATSAPP_PHONE_ID")
    sent_via = "link"
    link = None

    if token and phone_id:
        req = urllib.request.Request(
            f"https://graph.facebook.com/v19.0/{phone_id}/messages",
            data=json.dumps({
                "messaging_product": "whatsapp",
                "to": digits,
                "type": "text",
                "text": {"body": payload.message},
            }).encode(),
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as res:
                json.loads(res.read())
            sent_via = "api"
        except Exception as e:  # surface Meta API errors to the UI
            raise HTTPException(status_code=502, detail=f"WhatsApp API error: {e}")
    else:
        link = f"https://wa.me/{digits}?text={urllib.parse.quote(payload.message)}"

    who = contact.name if contact else raw
    a = _log(db, user, payload, contact, "whatsapp", f"WhatsApp → {who}")
    return {"sent_via": sent_via, "link": link, "activity": activity_out(a)}


@router.post("/email")
def send_email(payload: MessageIn, user: User = Depends(require_write), db: Session = Depends(get_db)):
    contact = _get_contact(db, user, payload.contact_id)
    to_email = payload.to or (contact.email if contact else None)
    if not to_email or "@" not in to_email:
        raise HTTPException(status_code=422, detail="No email address for this recipient")
    subject = (payload.subject or "").strip() or "Follow-up"
    if not payload.message.strip():
        raise HTTPException(status_code=422, detail="Message is empty")

    host = os.getenv("SMTP_HOST")
    sent_via = "link"
    link = None

    if host:
        msg = EmailMessage()
        msg["From"] = os.getenv("SMTP_FROM", os.getenv("SMTP_USER", user.email))
        msg["To"] = to_email
        msg["Subject"] = subject
        msg["Reply-To"] = user.email
        msg.set_content(payload.message)
        try:
            port = int(os.getenv("SMTP_PORT", "587"))
            with smtplib.SMTP(host, port, timeout=20) as s:
                s.starttls()
                smtp_user = os.getenv("SMTP_USER")
                if smtp_user:
                    s.login(smtp_user, os.getenv("SMTP_PASSWORD", ""))
                s.send_message(msg)
            sent_via = "api"
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"SMTP error: {e}")
    else:
        q = urllib.parse.urlencode({"subject": subject, "body": payload.message})
        link = f"mailto:{to_email}?{q}"

    who = contact.name if contact else to_email
    a = _log(db, user, payload, contact, "email", f"Email → {who}: {subject}")
    return {"sent_via": sent_via, "link": link, "activity": activity_out(a)}
