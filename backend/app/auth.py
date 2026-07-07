import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from .database import get_db
from .models import Membership, User

SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production")
ALGORITHM = "HS256"
TOKEN_TTL_HOURS = int(os.getenv("TOKEN_TTL_HOURS", "12"))

pwd_context = CryptContext(schemes=["pbkdf2_sha256"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user: User, org_id: int) -> str:
    """Token is scoped to one ACTIVE company; switching companies mints a new token."""
    payload = {
        "sub": str(user.id),
        "org": org_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_TTL_HOURS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> User:
    """Resolve user + active-company membership.

    The returned User instance carries transient attributes org_id / role /
    membership for the active company, so downstream code can keep using
    user.org_id and user.role.
    """
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token"
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        raise credentials_error
    user = db.get(User, int(payload.get("sub", 0)))
    if user is None or not user.is_active:
        raise credentials_error
    membership = (
        db.query(Membership)
        .filter(Membership.user_id == user.id, Membership.org_id == payload.get("org"))
        .first()
    )
    if membership is None:
        raise credentials_error
    user.org_id = membership.org_id
    user.role = membership.role
    user.membership = membership
    return user


def require_write(user: User = Depends(get_current_user)) -> User:
    """Viewers are read-only across the whole app."""
    if user.role == "viewer":
        raise HTTPException(status_code=403, detail="Read-only role")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    return user


def visible_user_ids(db: Session, user: User) -> list[int] | None:
    """Ownership scope: None means 'all in org' (admin, viewer, executives).

    Managers see their own records plus their direct reports'; reps see their
    own (unowned records are shared and visible to everyone).
    """
    if user.role in ("admin", "viewer"):
        return None
    if user.role == "manager":
        reports = (
            db.query(Membership.user_id)
            .filter(Membership.org_id == user.org_id, Membership.manager_id == user.id)
            .all()
        )
        return [user.id] + [r[0] for r in reports]
    return [user.id]
