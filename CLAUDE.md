# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Backend (from backend/, venv at backend/.venv, Python 3.10+ — system python3 is 3.9 and will fail)
.venv/bin/python -m app.seed                       # drop + recreate schema, load demo data
.venv/bin/uvicorn app.main:app --reload --port 8000
DATABASE_URL=sqlite:///./dev.db <cmd>              # run against SQLite instead of Postgres

# Frontend (from frontend/)
npm start                                          # ng serve on :4200 (expects API on :8000)
npm run build                                      # production build; strict templates catch errors

# Postgres
docker compose up -d db                            # crm/crm@localhost:5432/crm
```

There is no test suite; verify backend changes by seeding SQLite and curling endpoints (login first: `POST /api/auth/login` with `admin@umoya.demo` / `Demo123!`), and frontend changes with `npm run build`.

## Architecture

Multi-tenant CRM: Angular 17 SPA (standalone components, inline templates, signals) → FastAPI REST under `/api` → SQLAlchemy 2 / Postgres.

Backend layering (all in `backend/app/`):
- `models.py` is the schema source of truth; every business table has `org_id`. `schema.sql` is *generated* from it — regenerate rather than edit.
- `schemas.py` = Pydantic input models only. Responses are built by `serializers.py`, which returns enriched dicts (display names, `is_stale`, `days_in_stage`, `weighted_amount`). Add computed UI fields there, not in routers.
- Tenancy + RBAC live in `auth.py`: every router query must filter by `user.org_id`; ownership visibility via `visible_user_ids()` (None = see all). Write endpoints depend on `require_write` (blocks the viewer role).
- All pipeline business rules (stage gates, loss-reason requirement, Closed Won → auto Sale + optional Project, stage history, audit log) are in `routers/opportunities.py::change_stage`. Stage moves must go through `POST /opportunities/{id}/stage` — `PUT /opportunities/{id}` deliberately ignores `stage_id`.
- Money rollups convert to the org base currency via `utils.rates_map`/`to_base`; records keep their own currency.
- Stale detection depends on `Opportunity.last_activity_at`, which is only refreshed in `routers/activities_products.py::_touch_opportunity` — keep that in sync if activities gain new write paths.

Frontend conventions (`frontend/src/app/`):
- `core/` holds the singletons: `ApiService` (promise-based HTTP), `AuthService` (token + role helpers `canWrite`/`isAdmin` — gate every mutating UI on them), `I18nService` + `tr` pipe (EN/PT dicts; add keys to BOTH), `money` pipe (per-record currency), `ListState` (client-side filter/sort/paginate used by all list pages).
- Components use inline templates with the new `@if/@for` control flow; forms are template-driven (`FormsModule`). Shared modal, activity timeline (with quick-log form) and opportunity form are in `shared/`.
- Error toasts: catch and call `ToastService.error(e)` — it surfaces FastAPI's `detail`. Duplicate detection returns HTTP 409; UIs offer a "create anyway" retry with `?force=true`.

Constraints discovered on this machine: Node is 18.14 → Angular must stay on ^17.x; use `/opt/local/bin/python3.11` for venvs; if `npm install` hits EACCES on `~/.npm`, pass `--cache <tmpdir>`.
