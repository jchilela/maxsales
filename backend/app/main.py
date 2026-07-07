import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, SessionLocal, engine
from .routers import (
    accounts,
    activities_products,
    analytics,
    auth_users,
    messaging,
    opportunities,
    org_settings,
    sales_projects,
)

app = FastAPI(
    title="MaxSales CRM API",
    description="Multi-tenant B2B CRM for cloud/connectivity/hosting/consulting companies. "
    "All endpoints (except login) require a Bearer token and are scoped to the user's organization.",
    version="1.0.0",
)

_default_origins = ["http://localhost:4200", "http://127.0.0.1:4200"]
_extra_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_default_origins + _extra_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)


@app.on_event("startup")
def seed_demo_if_empty():
    """On hosted free tiers there is no shell to run the seed manually, so an
    empty database is seeded automatically when SEED_DEMO=1."""
    if os.getenv("SEED_DEMO") != "1":
        return
    from .models import Organization

    db = SessionLocal()
    try:
        if db.query(Organization).count() == 0:
            from .seed import seed_org1, seed_org2

            alice = seed_org1(db)
            seed_org2(db, alice)
    finally:
        db.close()

app.include_router(auth_users.router)
app.include_router(accounts.router)
app.include_router(opportunities.router)
app.include_router(sales_projects.router)
app.include_router(activities_products.router)
app.include_router(analytics.router)
app.include_router(org_settings.router)
app.include_router(messaging.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
