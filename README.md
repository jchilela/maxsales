# MaxSales CRM

A multi-tenant **SaaS** Salesforce-style CRM for B2B technology / infrastructure companies
(cloud services, connectivity, hosting, consulting).

**SaaS model:** anyone can sign up at `/signup` and get their own company workspace
(default pipeline + currencies provisioned automatically). One login can belong to
several companies — use the company switcher in the top bar, or "＋ New company"
to create another one you own. Inviting an email that already has an account
(Settings → Users) adds that person to your company instead of creating a duplicate.

**Stack:** Angular 17 (standalone components, signals) · FastAPI · PostgreSQL (SQLAlchemy 2) · JWT auth with RBAC.

**Languages:** English + Portuguese (switchable in the top bar). **Currencies:** USD, AOA, EUR (multi-currency with per-org base currency and configurable rates).

---

## 0. Free hosting

**Frontend (live):** https://jchilela.github.io/maxsales/ — auto-deployed from `main` by
`.github/workflows/deploy-pages.yml`. Every push redeploys it.

**Backend + database (two free accounts, ~5 minutes):**

1. **Neon** (database): sign up at https://neon.tech (free tier, doesn't expire) → create a
   project → copy the connection string (`postgresql://…sslmode=require`).
2. **Render** (API): sign up at https://render.com → **New → Blueprint** → connect the
   `jchilela/maxsales` repo. It reads `render.yaml`, creates the free `maxsales-api` service
   and prompts for `DATABASE_URL` — paste the Neon string. First boot creates the schema and
   seeds the demo data automatically (`SEED_DEMO=1`; set it to `0` afterwards for a clean start).
3. **Point the frontend at it:** in GitHub → repo → Settings → Secrets and variables →
   Actions → Variables → new variable `API_URL` = `https://maxsales-api.onrender.com/api`
   (your Render URL + `/api`), then re-run the "Deploy frontend to GitHub Pages" workflow.

Free-tier trade-off: Render sleeps the API after 15 idle minutes; the first request after
that takes ~30–60 s to wake. Until you do steps 1–3, the live frontend talks to
`http://localhost:8000` — i.e. it works on your machine while the local backend is running.

## 1. Run locally

Prerequisites: Python 3.10+, Node 18.13+, Docker (only for Postgres — optional, see SQLite note).

```bash
# 1. Database
docker compose up -d db            # Postgres 16 on localhost:5432 (crm/crm)

# 2. Backend (http://localhost:8000, API docs at /docs)
cd backend
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -m app.seed                 # create schema + demo data (destructive: drops tables)
uvicorn app.main:app --reload --port 8000

# 3. Frontend (http://localhost:4200)
cd ../frontend
npm install
npm start
```

**No Docker?** Use SQLite instead — in `backend/.env` set
`DATABASE_URL=sqlite:///./dev.db`, then seed and start the same way.

### Demo logins (password `Demo123!` for all)

| Email | Role | Sees |
|---|---|---|
| `admin@umoya.demo` | Admin of **both** companies | Umoya + Lisboa — try the company switcher in the top bar |
| `manager@umoya.demo` | Sales manager | Own records + team (Carla, David) |
| `carla@umoya.demo` / `david@umoya.demo` | Sales rep | Own + unassigned records |
| `ceo@umoya.demo` | Viewer (executive) | Everything, read-only |
| `admin@lisboa.demo` | Admin, **second tenant** | Only Lisboa Digital Consulting data |

Log in as `admin@lisboa.demo` to confirm tenant isolation: none of Umoya's data is visible.

---

## 2. Data model (ERD summary)

Full DDL: [`backend/schema.sql`](backend/schema.sql) (generated from the SQLAlchemy models).
Every business table carries `org_id` → `organizations` (tenant scoping).

```
users (global identity) *──* organizations via memberships
                             (per-company role: admin|manager|rep|viewer,
                              per-company manager_id for teams, is_owner flag)
organizations ─┬─ currency_rates (code → rate_to_base)
               ├─ pipeline_stages (order, probability, is_won/is_lost, requires_amount)
               ├─ products (catalog: price, currency, recurring flag)
               ├─ sales_targets (user × year × quarter)
               └─ audit_log (entity, action, JSON diff, user, timestamp)

accounts 1─* contacts
accounts 1─* opportunities *─1 pipeline_stages
                            1─* opportunity_line_items *─1 products
                            1─* stage_history (from/to stage, who, when)
opportunities 1─1 sales (created automatically on Closed Won)
accounts 1─* projects 1─* milestones     (project links back to sale/opportunity)
activities *─1 (account | contact | opportunity | project)   — nullable FKs, one timeline
```

Key columns worth knowing:

- `opportunities.status` (`open|won|lost`) is derived from the stage's `is_won/is_lost` flags; `closed_at`, `stage_entered_at`, `last_activity_at` power cycle-time and staleness analytics.
- `sales.billing_type` (`one_off|recurring`) + `mrr` drive the MRR/ARR rollups.
- `currency_rates.rate_to_base`: all dashboard/report rollups convert amounts into the org's base currency; individual records keep and display their own currency.

## 3. Module walkthrough — Lead to delivery

1. **Account & contacts** — create the client on *Accounts* (duplicate names are flagged), add contacts (duplicate emails are flagged, decision-makers starred).
2. **Opportunity** — create it from the *Pipeline* board or the account page. It starts in *Lead* with the stage's default probability. Add catalog line items on the opportunity page; the amount is recalculated from them.
3. **Working the deal** — log calls/meetings/WhatsApp/tasks on the timeline (this refreshes `last_activity_at`; deals with no activity for N days — default 14, configurable in Settings — are flagged **stale** on the board and dashboard). Drag the card across stages; entering *Proposal Sent* or beyond requires amount + close date (HTTP 422 otherwise). Every move is written to `stage_history` and the audit log.
4. **Closing** — *Closed Lost* demands a loss reason (analyzed in Reports). *Closed Won* automatically creates a **Sale** (recurring if any line item is a recurring product → MRR = value/12) and, if you tick the box, a delivery **Project**; the account flips from prospect to active.
5. **Delivery** — track the project on *Projects* (list or status board): milestones, % complete, green/yellow/red health, steering-committee activities.
6. **Money** — *Sales* shows contract values, MRR/ARR rollups and invoicing status; *Dashboard* shows quarter sales vs. per-rep targets; *Reports* gives sales by owner/product/country/quarter, funnel conversion, average deal size, cycle length and loss reasons — all exportable to CSV.

## 3b. WhatsApp & email follow-ups from the portal

Compose buttons (💬 / ✉️) live on the opportunity page, the account 360 contact list, and the contacts page. Pick a recipient, apply a follow-up template (EN/PT, auto-filled with contact/deal names) and hit send. Every message is logged as an activity on the record's timeline and refreshes the stale-deal clock.

Delivery modes (automatic):

- **Default (zero setup):** the portal opens WhatsApp / your mail client with the chat and message pre-filled — you press send once. WhatsApp messages go out **from your own number** (stay logged into WhatsApp Web / the app with +244 931 405 768).
- **Direct sending:** set env vars in `backend/.env` and the server sends without any click —
  `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_ID` (Meta WhatsApp Business Cloud API; register your number at developers.facebook.com — free tier available), and/or `SMTP_HOST/PORT/USER/PASSWORD/FROM` for email (e.g. a Gmail app password). Errors from Meta/SMTP surface in the UI as toasts.

## 4. Business rules implemented

- Weighted pipeline = Σ(amount × probability), converted to org base currency.
- Stage-gate validation (`requires_amount`), loss-reason requirement, auto Sale/Project on win.
- Stale-deal flagging (configurable days), duplicate detection (account name, contact email — override with `?force=true` / "Create anyway").
- Audit log on opportunities and sales (who, what, when, old → new values) — visible on the opportunity page.
- RBAC: viewers read-only everywhere; reps see own + unassigned records; managers additionally see direct reports' records; admins see all. All queries tenant-scoped by `org_id` from the JWT.
- Timezone-aware timestamps (UTC in the API, localized in the UI); currency formatted per record.

## 5. API

REST, documented via OpenAPI at **http://localhost:8000/docs** (use the Authorize button with any demo login). All endpoints live under `/api`; everything except `POST /api/auth/login` requires `Authorization: Bearer <token>`.

Notable endpoints: `GET /dashboard`, `POST /opportunities/{id}/stage` (all stage-transition rules), `PUT /opportunities/{id}/line-items`, `GET /reports/*?format=csv`, `GET /search?q=`, `GET /audit`.

SaaS endpoints: `POST /auth/register` (public signup → new company + admin), `POST /auth/switch-org` (mints a token scoped to another of your companies), `POST /orgs` (create an additional company you own). The JWT always carries exactly one active company; every query is scoped by it.

## 6. Repository layout

```
backend/
  app/main.py            FastAPI app + CORS + router registration
  app/models.py          SQLAlchemy models (source of truth for the schema)
  app/schemas.py         Pydantic input validation
  app/serializers.py     enriched dict output (names, stale flag, totals)
  app/auth.py            JWT, password hashing, RBAC helpers
  app/routers/           auth_users, accounts(+contacts), opportunities(+stages),
                         sales_projects, activities_products, analytics, org_settings
  app/seed.py            demo data (2 tenants) — python -m app.seed
  schema.sql             generated Postgres DDL
frontend/
  src/app/core/          auth, API client, i18n (EN/PT), toasts, money pipe, list helper
  src/app/shared/        shell (sidebar/topbar/global search), modal, timeline, opportunity form
  src/app/pages/         dashboard, pipeline (Kanban), accounts, account-360, contacts,
                         opportunity detail, sales, projects (+detail), activities,
                         reports, settings, login
docker-compose.yml       Postgres 16
```
