from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200", "http://127.0.0.1:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

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
