from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from ..auth import (
    create_access_token,
    get_current_user,
    hash_password,
    require_admin,
    verify_password,
)
from ..database import get_db
from ..models import Membership, Organization, User
from ..provisioning import provision_company
from ..schemas import LoginIn, UserIn
from ..serializers import user_out

router = APIRouter(prefix="/api", tags=["auth & users"])


class RegisterIn(BaseModel):
    company_name: str
    base_currency: str = "USD"
    full_name: str
    email: EmailStr
    password: str
    language: str = "en"


class NewCompanyIn(BaseModel):
    name: str
    base_currency: str = "USD"


class SwitchOrgIn(BaseModel):
    org_id: int


def _org_out(org: Organization) -> dict:
    return {"id": org.id, "name": org.name, "base_currency": org.base_currency}


def _my_orgs(db: Session, user: User) -> list[dict]:
    rows = (
        db.query(Membership, Organization)
        .join(Organization, Organization.id == Membership.org_id)
        .filter(Membership.user_id == user.id)
        .order_by(Organization.name)
        .all()
    )
    return [{**_org_out(org), "role": m.role, "is_owner": m.is_owner} for m, org in rows]


def _session_payload(db: Session, user: User, membership: Membership) -> dict:
    org = db.get(Organization, membership.org_id)
    return {
        "access_token": create_access_token(user, org.id),
        "token_type": "bearer",
        "user": user_out(user, membership),
        "org": _org_out(org),
        "orgs": _my_orgs(db, user),
    }


@router.post("/auth/register", status_code=201)
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    """Public SaaS signup: creates the company + its first admin user."""
    if db.query(User).filter(User.email == payload.email.lower()).first():
        raise HTTPException(
            status_code=409,
            detail="This email already has an account. Log in and use 'New company' to add another company.",
        )
    if not payload.company_name.strip():
        raise HTTPException(status_code=422, detail="Company name is required")
    user = User(
        email=payload.email.lower(),
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        language=payload.language,
    )
    db.add(user)
    db.flush()
    provision_company(db, payload.company_name.strip(), payload.base_currency, user)
    db.commit()
    membership = db.query(Membership).filter(Membership.user_id == user.id).first()
    return _session_payload(db, user, membership)


@router.post("/auth/login")
def login(payload: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User is deactivated")
    membership = (
        db.query(Membership).filter(Membership.user_id == user.id).order_by(Membership.id).first()
    )
    if not membership:
        raise HTTPException(status_code=403, detail="No company memberships for this user")
    return _session_payload(db, user, membership)


@router.post("/auth/token", include_in_schema=False)
def login_form(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """OAuth2 form variant so Swagger UI's Authorize button works."""
    return login(LoginIn(email=form.username, password=form.password), db)


@router.post("/auth/switch-org")
def switch_org(payload: SwitchOrgIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    membership = (
        db.query(Membership)
        .filter(Membership.user_id == user.id, Membership.org_id == payload.org_id)
        .first()
    )
    if not membership:
        raise HTTPException(status_code=403, detail="You are not a member of that company")
    return _session_payload(db, user, membership)


@router.post("/orgs", status_code=201)
def create_company(payload: NewCompanyIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Any signed-in user can create an additional company they own."""
    if not payload.name.strip():
        raise HTTPException(status_code=422, detail="Company name is required")
    org = provision_company(db, payload.name.strip(), payload.base_currency, user)
    db.commit()
    membership = (
        db.query(Membership)
        .filter(Membership.user_id == user.id, Membership.org_id == org.id)
        .first()
    )
    return _session_payload(db, user, membership)


@router.get("/auth/me")
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    org = db.get(Organization, user.org_id)
    return {
        "user": user_out(user, user.membership),
        "org": {**_org_out(org), "stale_days": org.stale_days},
        "orgs": _my_orgs(db, user),
    }


# ---------------------------------------------------------------- users (per active company)


@router.get("/users")
def list_users(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = (
        db.query(Membership, User)
        .join(User, User.id == Membership.user_id)
        .filter(Membership.org_id == user.org_id)
        .order_by(User.full_name)
        .all()
    )
    return [user_out(u, m) for m, u in rows]


@router.post("/users", status_code=201)
def create_user(payload: UserIn, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Add a member to the active company. If the email already has an
    account (e.g. someone who works across your companies), a membership is
    added instead of a new account."""
    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        dup = (
            db.query(Membership)
            .filter(Membership.user_id == existing.id, Membership.org_id == admin.org_id)
            .first()
        )
        if dup:
            raise HTTPException(status_code=409, detail="This user is already a member of this company")
        m = Membership(
            user_id=existing.id, org_id=admin.org_id,
            role=payload.role, manager_id=payload.manager_id,
        )
        db.add(m)
        db.commit()
        return user_out(existing, m)
    if not payload.password:
        raise HTTPException(status_code=422, detail="Password required for new users")
    u = User(
        email=payload.email.lower(),
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        language=payload.language,
        is_active=payload.is_active,
    )
    db.add(u)
    db.flush()
    m = Membership(user_id=u.id, org_id=admin.org_id, role=payload.role, manager_id=payload.manager_id)
    db.add(m)
    db.commit()
    return user_out(u, m)


@router.put("/users/{user_id}")
def update_user(user_id: int, payload: UserIn, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    m = (
        db.query(Membership)
        .filter(Membership.user_id == user_id, Membership.org_id == admin.org_id)
        .first()
    )
    if not m:
        raise HTTPException(status_code=404, detail="User not found in this company")
    u = db.get(User, user_id)
    if payload.email.lower() != u.email and db.query(User).filter(User.email == payload.email.lower()).first():
        raise HTTPException(status_code=409, detail="Email already in use")
    u.email = payload.email.lower()
    u.full_name = payload.full_name
    u.language = payload.language
    u.is_active = payload.is_active
    if payload.password:
        u.hashed_password = hash_password(payload.password)
    m.role = payload.role
    m.manager_id = payload.manager_id
    db.commit()
    return user_out(u, m)


@router.delete("/users/{user_id}", status_code=204)
def remove_user(user_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Remove from the active company only; the account itself survives if it
    belongs to other companies."""
    m = (
        db.query(Membership)
        .filter(Membership.user_id == user_id, Membership.org_id == admin.org_id)
        .first()
    )
    if not m:
        raise HTTPException(status_code=404, detail="User not found in this company")
    if m.is_owner:
        raise HTTPException(status_code=403, detail="The company owner cannot be removed")
    db.delete(m)
    remaining = db.query(Membership).filter(Membership.user_id == user_id).count()
    if remaining == 0:
        db.get(User, user_id).is_active = False
    db.commit()
