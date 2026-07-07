"""Seed the database with realistic demo data for two tenant organizations.

Run:  python -m app.seed        (drops and recreates all tables)
"""
import random
from datetime import date, datetime, timedelta, timezone

from .auth import hash_password
from .database import Base, SessionLocal, engine
from .models import (
    Account,
    Activity,
    Contact,
    CurrencyRate,
    Membership,
    Milestone,
    Opportunity,
    OpportunityLineItem,
    Organization,
    PipelineStage,
    Product,
    Project,
    Sale,
    SalesTarget,
    StageHistory,
    User,
)
from .utils import quarter_of

random.seed(42)
NOW = datetime.now(timezone.utc)
TODAY = date.today()
PASSWORD = hash_password("Demo123!")

STAGES = [
    # name, order, probability, is_won, is_lost, requires_amount
    ("Lead", 1, 10, False, False, False),
    ("Qualified", 2, 25, False, False, False),
    ("Proposal Sent", 3, 50, False, False, True),
    ("Negotiation", 4, 70, False, False, True),
    ("Contract", 5, 90, False, False, True),
    ("Closed Won", 6, 100, True, False, False),
    ("Closed Lost", 7, 0, False, True, False),
]


def days_ago(n: int) -> datetime:
    return NOW - timedelta(days=n)


def make_stages(db, org_id):
    out = {}
    for name, order, prob, won, lost, req in STAGES:
        s = PipelineStage(
            org_id=org_id, name=name, sort_order=order, probability=prob,
            is_won=won, is_lost=lost, requires_amount=req,
        )
        db.add(s)
        db.flush()
        out[name] = s
    return out


def seed_org1(db):
    org = Organization(name="Umoya Cloud & Connectivity", base_currency="USD", stale_days=14)
    db.add(org)
    db.flush()
    for code, rate in [("USD", 1.0), ("EUR", 1.09), ("AOA", 0.0011)]:
        db.add(CurrencyRate(org_id=org.id, code=code, rate_to_base=rate))
    stages = make_stages(db, org.id)

    def user(email, name, role, manager=None, lang="en", owner=False):
        u = User(email=email, hashed_password=PASSWORD, full_name=name, language=lang)
        db.add(u)
        db.flush()
        db.add(Membership(
            user_id=u.id, org_id=org.id, role=role,
            manager_id=manager.id if manager else None, is_owner=owner,
        ))
        return u

    admin = user("admin@umoya.demo", "Alice Neto", "admin", owner=True)
    manager = user("manager@umoya.demo", "Bruno Cardoso", "manager", lang="pt")
    rep1 = user("carla@umoya.demo", "Carla Domingos", "rep", manager, lang="pt")
    rep2 = user("david@umoya.demo", "David Mensah", "rep", manager)
    user("ceo@umoya.demo", "Esperança Vieira", "viewer", lang="pt")

    products = {}
    for name, cat, price, cur, rec in [
        ("Cloud Compute — Standard", "Cloud", 450, "USD", True),
        ("Cloud Compute — Enterprise", "Cloud", 1800, "USD", True),
        ("Managed Kubernetes", "Cloud", 950, "USD", True),
        ("Dedicated Fiber 100Mbps", "Connectivity", 700, "USD", True),
        ("Dedicated Fiber 1Gbps", "Connectivity", 2400, "USD", True),
        ("Web Hosting — Business", "Hosting", 60, "USD", True),
        ("Migration Consulting (day)", "Consulting", 850, "USD", False),
        ("Network Design Project", "Consulting", 12000, "USD", False),
        ("Disaster Recovery Setup", "Consulting", 18000, "USD", False),
    ]:
        p = Product(org_id=org.id, name=name, category=cat, unit_price=price, currency=cur, is_recurring=rec)
        db.add(p)
        db.flush()
        products[name] = p

    accounts_spec = [
        ("Banco Kwanza Invest", "Banking", "enterprise", "Angola", "AOA", "active", rep1),
        ("Sonangol Distribuição", "Oil & Gas", "enterprise", "Angola", "USD", "active", rep2),
        ("Luanda Medical Center", "Healthcare", "smb", "Angola", "AOA", "active", rep1),
        ("Ministério das Telecomunicações", "Government", "government", "Angola", "AOA", "prospect", rep2),
        ("Porto Digital Ventures", "Technology", "smb", "Portugal", "EUR", "active", rep1),
        ("Maputo Logistics Group", "Logistics", "smb", "Mozambique", "USD", "prospect", rep2),
        ("Zenith Retail Angola", "Retail", "enterprise", "Angola", "AOA", "active", rep1),
        ("Cabo Verde Airlines Cargo", "Transportation", "smb", "Cape Verde", "EUR", "prospect", rep2),
        ("Namibe Fisheries Co.", "Agriculture & Fishing", "smb", "Angola", "USD", "churned", rep1),
        ("Uni Católica de Angola", "Education", "government", "Angola", "AOA", "prospect", rep2),
    ]
    accounts = []
    for i, (name, industry, seg, country, cur, status, owner) in enumerate(accounts_spec):
        a = Account(
            org_id=org.id, name=name, industry=industry, segment=seg, country=country,
            website=f"https://www.{name.lower().replace(' ', '').replace('.', '')[:18]}.com",
            tax_id=f"54{1000 + i * 7}", owner_id=owner.id, status=status,
            annual_revenue=random.choice([2, 5, 12, 40, 90]) * 1_000_000,
            notes="Key strategic account." if seg == "enterprise" else None,
        )
        db.add(a)
        db.flush()
        a._currency = cur
        accounts.append(a)

    first_names = ["João", "Maria", "Pedro", "Ana", "Miguel", "Sofia", "Tiago", "Inês",
                   "Carlos", "Beatriz", "Rui", "Helena", "Nelson", "Luísa", "Mário",
                   "Teresa", "Paulo", "Vera", "Hugo", "Cátia", "Samuel", "Rita", "Jorge",
                   "Marta", "Filipe"]
    last_names = ["dos Santos", "Ferreira", "Machado", "Baptista", "Gomes", "Van-Dúnem",
                  "Cabral", "Tavares", "Lopes", "Miranda"]
    titles = ["CTO", "IT Director", "CFO", "Procurement Manager", "CEO",
              "Head of Infrastructure", "Operations Director", "IT Manager"]
    contacts = []
    for i in range(25):
        acc = accounts[i % len(accounts)]
        fn, ln = first_names[i], last_names[i % len(last_names)]
        c = Contact(
            org_id=org.id, account_id=acc.id, name=f"{fn} {ln}",
            role_title=titles[i % len(titles)],
            email=f"{fn.lower().replace('ã','a').replace('í','i').replace('ú','u').replace('é','e').replace('á','a')}.{ln.split()[-1].lower().replace('ú','u')}@{acc.website.split('www.')[1]}",
            phone=f"+244 9{random.randint(10000000, 99999999)}",
            whatsapp=f"+244 9{random.randint(10000000, 99999999)}",
            is_decision_maker=(i % 3 == 0),
            preferred_language="pt" if acc.country in ("Angola", "Mozambique", "Portugal") else "en",
        )
        db.add(c)
        db.flush()
        contacts.append(c)

    def contact_for(acc):
        return next((c for c in contacts if c.account_id == acc.id), None)

    opp_spec = [
        # name, account idx, stage, amount, product_line, source, days old
        ("Core banking cloud migration", 0, "Negotiation", 145000, "Cloud", "referral", 60),
        ("Branch connectivity — 12 sites", 0, "Closed Won", 86400, "Connectivity", "outbound", 150),
        ("DR site implementation", 1, "Proposal Sent", 64000, "Consulting", "inbound", 45),
        ("Terminal fiber backbone", 1, "Closed Won", 120000, "Connectivity", "partner", 200),
        ("Patient records hosting", 2, "Contract", 38000, "Hosting", "inbound", 30),
        ("Telemedicine platform infra", 2, "Qualified", 27000, "Cloud", "event", 20),
        ("National broadband study", 3, "Proposal Sent", 95000, "Consulting", "outbound", 55),
        ("Gov data center advisory", 3, "Lead", 150000, "Consulting", "event", 8),
        ("Startup cloud credits deal", 4, "Closed Won", 21600, "Cloud", "inbound", 90),
        ("K8s platform buildout", 4, "Negotiation", 34000, "Cloud", "referral", 25),
        ("Fleet tracking backend", 5, "Qualified", 18000, "Cloud", "outbound", 35),
        ("Warehouse WAN links", 5, "Lead", 22000, "Connectivity", "outbound", 5),
        ("Retail POS network refresh", 6, "Closed Won", 74000, "Connectivity", "partner", 120),
        ("E-commerce hosting upgrade", 6, "Proposal Sent", 15500, "Hosting", "inbound", 18),
        ("Omnichannel infra consulting", 6, "Closed Lost", 40000, "Consulting", "referral", 100),
        ("Cargo tracking system infra", 7, "Qualified", 29000, "Cloud", "event", 15),
        ("Airport office connectivity", 7, "Lead", 9500, "Connectivity", "inbound", 3),
        ("Cold storage monitoring", 8, "Closed Lost", 16000, "Cloud", "outbound", 130),
        ("Campus network upgrade", 9, "Negotiation", 58000, "Connectivity", "outbound", 40),
        ("Student portal hosting", 9, "Lead", 12000, "Hosting", "inbound", 6),
    ]
    loss_reasons = ["Lost to competitor on price", "Project cancelled by client"]
    owners = [rep1, rep2]
    opps = []
    for i, (name, ai, stage_name, amount, line, source, age) in enumerate(opp_spec):
        acc = accounts[ai]
        stage = stages[stage_name]
        owner = owners[i % 2]
        created = days_ago(age)
        is_won = stage.is_won
        is_lost = stage.is_lost
        o = Opportunity(
            org_id=org.id, name=name, account_id=acc.id,
            primary_contact_id=contact_for(acc).id if contact_for(acc) else None,
            owner_id=owner.id, amount=amount, currency=acc._currency if acc._currency != "AOA" else "USD",
            probability=100 if is_won else (0 if is_lost else stage.probability),
            expected_close_date=TODAY + timedelta(days=random.randint(10, 90)) if not (is_won or is_lost)
            else created.date() + timedelta(days=random.randint(20, 60)),
            source=source, product_line=line,
            competitors="Local ISP" if line == "Connectivity" else None,
            next_step=None if (is_won or is_lost) else "Follow up with decision maker",
            stage_id=stage.id,
            status="won" if is_won else ("lost" if is_lost else "open"),
            loss_reason=loss_reasons[i % 2] if is_lost else None,
            created_at=created,
            stage_entered_at=days_ago(random.randint(0, min(age, 21))),
            closed_at=days_ago(random.randint(1, max(2, age - 30))) if (is_won or is_lost) else None,
        )
        db.add(o)
        db.flush()
        # stage history walk from Lead to current stage
        path = [s for s in STAGES if s[1] <= stage.sort_order and not s[4]] if not is_lost else STAGES[:3] + [STAGES[6]]
        prev = None
        step_at = created
        for sname, *_ in [(p[0],) for p in path]:
            db.add(StageHistory(
                opportunity_id=o.id, from_stage_id=prev, to_stage_id=stages[sname].id,
                changed_by_id=owner.id, changed_at=step_at,
            ))
            prev = stages[sname].id
            step_at = step_at + timedelta(days=max(1, age // max(1, len(path))))
        # line items for bigger open deals
        if not (is_won or is_lost) and amount > 25000:
            p1 = products["Cloud Compute — Enterprise"] if line == "Cloud" else products["Dedicated Fiber 1Gbps"]
            db.add(OpportunityLineItem(opportunity_id=o.id, product_id=p1.id, quantity=12, unit_price=p1.unit_price, discount_pct=10))
            db.add(OpportunityLineItem(opportunity_id=o.id, product_id=products["Migration Consulting (day)"].id, quantity=10, unit_price=850, discount_pct=0))
        opps.append(o)

    # sales for won opportunities
    sales = []
    for o in [x for x in opps if x.status == "won"]:
        recurring = o.product_line in ("Cloud", "Connectivity", "Hosting")
        s = Sale(
            org_id=org.id, opportunity_id=o.id, account_id=o.account_id,
            contract_value=o.amount, currency=o.currency,
            billing_type="recurring" if recurring else "one_off",
            mrr=round(o.amount / 12, 2) if recurring else None,
            start_date=o.closed_at.date() if o.closed_at else TODAY,
            term_months=12 if recurring else None,
            invoicing_status=random.choice(["invoiced", "paid", "partially_invoiced"]),
        )
        db.add(s)
        db.flush()
        sales.append(s)
    # one extra sale starting today so dashboard month/quarter attainment shows movement
    s = Sale(
        org_id=org.id, opportunity_id=None, account_id=accounts[0].id,
        contract_value=45000, currency="USD", billing_type="recurring", mrr=3750,
        start_date=TODAY, term_months=12, invoicing_status="invoiced",
    )
    db.add(s)
    db.flush()
    sales.append(s)

    project_spec = [
        ("Branch connectivity rollout", 0, "in_progress", 65, "green"),
        ("Terminal backbone delivery", 1, "in_progress", 40, "yellow"),
        ("Cloud credits onboarding", 4, "delivered", 100, "green"),
        ("POS network refresh — wave 1", 6, "blocked", 30, "red"),
        ("DR readiness assessment", 1, "planning", 5, "green"),
    ]
    projects = []
    for name, ai, status, pct, health in project_spec:
        won_sale = next((x for x in sales if x.account_id == accounts[ai].id), None)
        p = Project(
            org_id=org.id, name=name, account_id=accounts[ai].id,
            sale_id=won_sale.id if won_sale else None,
            opportunity_id=won_sale.opportunity_id if won_sale else None,
            manager_id=manager.id, status=status,
            start_date=TODAY - timedelta(days=random.randint(20, 90)),
            end_date=TODAY + timedelta(days=random.randint(15, 120)),
            percent_complete=pct, health=health,
        )
        db.add(p)
        db.flush()
        for j, mname in enumerate(["Kickoff", "Design sign-off", "Implementation", "UAT", "Go-live"]):
            db.add(Milestone(
                project_id=p.id, name=mname,
                due_date=p.start_date + timedelta(days=14 * (j + 1)),
                is_done=(j + 1) * 20 <= pct,
            ))
        projects.append(p)

    act_types = ["call", "meeting", "email", "whatsapp", "task", "note"]
    subjects = {
        "call": "Discovery call", "meeting": "On-site technical meeting",
        "email": "Sent follow-up and pricing", "whatsapp": "Quick check-in on proposal",
        "task": "Prepare technical proposal", "note": "Client evaluating two vendors",
    }
    for i in range(40):
        o = opps[i % len(opps)]
        t = act_types[i % len(act_types)]
        done = i % 3 != 0
        due = NOW + timedelta(days=random.randint(-10, 14)) if t in ("task", "call", "meeting") else None
        a = Activity(
            org_id=org.id, type=t, subject=f"{subjects[t]} — {o.account.name}",
            description="Auto-seeded demo activity.",
            due_date=due, is_done=done, owner_id=o.owner_id,
            account_id=o.account_id, contact_id=o.primary_contact_id,
            opportunity_id=o.id, created_at=days_ago(random.randint(0, 30)),
        )
        db.add(a)
        if o.status == "open" and (o.last_activity_at is None or a.created_at > o.last_activity_at):
            o.last_activity_at = a.created_at
    # a few project activities
    for p in projects[:3]:
        db.add(Activity(
            org_id=org.id, type="meeting", subject=f"Steering committee — {p.name}",
            due_date=NOW + timedelta(days=7), is_done=False, owner_id=manager.id,
            account_id=p.account_id, project_id=p.id,
        ))

    for u, amount in ((rep1, 120000), (rep2, 120000), (manager, 250000)):
        for q in range(1, 5):
            db.add(SalesTarget(org_id=org.id, user_id=u.id, year=TODAY.year, quarter=q,
                               target_amount=amount))
    db.commit()
    return admin


def seed_org2(db, cross_org_admin: User):
    """Second tenant proves data isolation; cross_org_admin (Alice from Umoya)
    also gets an admin membership here to demo the company switcher."""
    org = Organization(name="Lisboa Digital Consulting", base_currency="EUR", stale_days=21)
    db.add(org)
    db.flush()
    for code, rate in [("EUR", 1.0), ("USD", 0.92)]:
        db.add(CurrencyRate(org_id=org.id, code=code, rate_to_base=rate))
    stages = make_stages(db, org.id)
    admin = User(email="admin@lisboa.demo", hashed_password=PASSWORD,
                 full_name="Duarte Silva", language="pt")
    db.add(admin)
    db.flush()
    db.add(Membership(user_id=admin.id, org_id=org.id, role="admin", is_owner=True))
    db.add(Membership(user_id=cross_org_admin.id, org_id=org.id, role="admin"))
    a = Account(org_id=org.id, name="TAP Cargo Systems", industry="Transportation",
                segment="enterprise", country="Portugal", owner_id=admin.id, status="active")
    db.add(a)
    db.flush()
    c = Contact(org_id=org.id, account_id=a.id, name="Marta Fonseca", role_title="CIO",
                email="marta@tapcargo.example", is_decision_maker=True, preferred_language="pt")
    db.add(c)
    db.flush()
    o = Opportunity(org_id=org.id, name="Cargo API modernization", account_id=a.id,
                    primary_contact_id=c.id, owner_id=admin.id, amount=80000, currency="EUR",
                    probability=50, expected_close_date=TODAY + timedelta(days=45),
                    source="referral", product_line="Consulting",
                    stage_id=stages["Proposal Sent"].id)
    db.add(o)
    db.flush()
    db.add(StageHistory(opportunity_id=o.id, to_stage_id=stages["Lead"].id, changed_by_id=admin.id))
    db.commit()


def main():
    print("Dropping and recreating schema…")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        alice = seed_org1(db)
        seed_org2(db, alice)
        print("Seed complete.")
        print("Logins (password Demo123! for all):")
        for e in ["admin@umoya.demo  (admin of BOTH companies — try the switcher)",
                  "manager@umoya.demo", "carla@umoya.demo",
                  "david@umoya.demo", "ceo@umoya.demo", "admin@lisboa.demo"]:
            print(f"  {e}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
