"""SQLAlchemy models for the CRM.

Every business record carries org_id: the app is multi-tenant and all queries
are scoped to the authenticated user's organization.
"""
from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from .database import Base


class Organization(Base):
    __tablename__ = "organizations"
    id = Column(Integer, primary_key=True)
    name = Column(String(120), nullable=False)
    base_currency = Column(String(3), nullable=False, default="USD")
    stale_days = Column(Integer, nullable=False, default=14)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CurrencyRate(Base):
    """1 unit of `code` equals `rate_to_base` units of the org's base currency."""

    __tablename__ = "currency_rates"
    id = Column(Integer, primary_key=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    code = Column(String(3), nullable=False)
    rate_to_base = Column(Float, nullable=False, default=1.0)


class User(Base):
    """Global identity. Company access and per-company role live in Membership,
    so one login can belong to (and switch between) several companies."""

    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String(255), nullable=False, unique=True, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(120), nullable=False)
    language = Column(String(5), nullable=False, default="en")  # en | pt
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    memberships = relationship("Membership", back_populates="user", foreign_keys="Membership.user_id")


class Membership(Base):
    __tablename__ = "memberships"
    __table_args__ = (UniqueConstraint("user_id", "org_id", name="uq_membership_user_org"),)
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    role = Column(String(20), nullable=False, default="rep")  # admin | manager | rep | viewer
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # team lead within this org
    is_owner = Column(Boolean, nullable=False, default=False)  # created the company
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="memberships", foreign_keys=[user_id])
    org = relationship("Organization")


class Account(Base):
    __tablename__ = "accounts"
    id = Column(Integer, primary_key=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    name = Column(String(200), nullable=False, index=True)
    industry = Column(String(100))
    segment = Column(String(20), default="smb")  # enterprise | smb | government
    country = Column(String(80))
    website = Column(String(255))
    tax_id = Column(String(60))
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String(20), nullable=False, default="prospect")  # prospect | active | churned
    annual_revenue = Column(Float)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    owner = relationship("User")
    contacts = relationship("Contact", back_populates="account", cascade="all, delete-orphan")
    opportunities = relationship("Opportunity", back_populates="account", cascade="all, delete-orphan")
    projects = relationship("Project", back_populates="account", cascade="all, delete-orphan")


class Contact(Base):
    __tablename__ = "contacts"
    id = Column(Integer, primary_key=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False, index=True)
    name = Column(String(150), nullable=False)
    role_title = Column(String(120))
    email = Column(String(255), index=True)
    phone = Column(String(60))
    whatsapp = Column(String(60))
    linkedin = Column(String(255))
    is_decision_maker = Column(Boolean, nullable=False, default=False)
    preferred_language = Column(String(5), default="en")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    account = relationship("Account", back_populates="contacts")


class PipelineStage(Base):
    __tablename__ = "pipeline_stages"
    id = Column(Integer, primary_key=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    name = Column(String(80), nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)
    probability = Column(Float, nullable=False, default=10)  # default % applied on entry
    is_won = Column(Boolean, nullable=False, default=False)
    is_lost = Column(Boolean, nullable=False, default=False)
    requires_amount = Column(Boolean, nullable=False, default=False)  # amount+close date gate


class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    name = Column(String(150), nullable=False)
    category = Column(String(100))
    unit_price = Column(Float, nullable=False, default=0)
    currency = Column(String(3), nullable=False, default="USD")
    is_recurring = Column(Boolean, nullable=False, default=False)
    description = Column(Text)
    is_active = Column(Boolean, nullable=False, default=True)


class Opportunity(Base):
    __tablename__ = "opportunities"
    id = Column(Integer, primary_key=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False, index=True)
    primary_contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    amount = Column(Float)
    currency = Column(String(3), nullable=False, default="USD")
    probability = Column(Float, nullable=False, default=10)
    expected_close_date = Column(Date)
    source = Column(String(30))  # referral | event | inbound | outbound | partner
    product_line = Column(String(100))
    competitors = Column(String(255))
    next_step = Column(String(255))
    stage_id = Column(Integer, ForeignKey("pipeline_stages.id"), nullable=False)
    status = Column(String(10), nullable=False, default="open")  # open | won | lost
    loss_reason = Column(String(255))
    stage_entered_at = Column(DateTime(timezone=True), server_default=func.now())
    last_activity_at = Column(DateTime(timezone=True), nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    account = relationship("Account", back_populates="opportunities")
    primary_contact = relationship("Contact")
    owner = relationship("User")
    stage = relationship("PipelineStage")
    line_items = relationship("OpportunityLineItem", back_populates="opportunity", cascade="all, delete-orphan")
    stage_history = relationship(
        "StageHistory", back_populates="opportunity", cascade="all, delete-orphan",
        order_by="StageHistory.changed_at",
    )


class OpportunityLineItem(Base):
    __tablename__ = "opportunity_line_items"
    id = Column(Integer, primary_key=True)
    opportunity_id = Column(Integer, ForeignKey("opportunities.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Float, nullable=False, default=1)
    unit_price = Column(Float, nullable=False, default=0)
    discount_pct = Column(Float, nullable=False, default=0)

    opportunity = relationship("Opportunity", back_populates="line_items")
    product = relationship("Product")

    @property
    def total(self) -> float:
        return round(self.quantity * self.unit_price * (1 - self.discount_pct / 100), 2)


class StageHistory(Base):
    __tablename__ = "stage_history"
    id = Column(Integer, primary_key=True)
    opportunity_id = Column(Integer, ForeignKey("opportunities.id"), nullable=False, index=True)
    from_stage_id = Column(Integer, ForeignKey("pipeline_stages.id"), nullable=True)
    to_stage_id = Column(Integer, ForeignKey("pipeline_stages.id"), nullable=False)
    changed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    changed_at = Column(DateTime(timezone=True), server_default=func.now())

    opportunity = relationship("Opportunity", back_populates="stage_history")
    from_stage = relationship("PipelineStage", foreign_keys=[from_stage_id])
    to_stage = relationship("PipelineStage", foreign_keys=[to_stage_id])
    changed_by = relationship("User")


class Sale(Base):
    __tablename__ = "sales"
    id = Column(Integer, primary_key=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    opportunity_id = Column(Integer, ForeignKey("opportunities.id"), nullable=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False, index=True)
    contract_value = Column(Float, nullable=False, default=0)
    currency = Column(String(3), nullable=False, default="USD")
    billing_type = Column(String(15), nullable=False, default="one_off")  # one_off | recurring
    mrr = Column(Float)  # monthly value when billing_type == recurring
    start_date = Column(Date)
    term_months = Column(Integer)
    invoicing_status = Column(String(20), nullable=False, default="not_invoiced")
    # not_invoiced | partially_invoiced | invoiced | paid
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    opportunity = relationship("Opportunity")
    account = relationship("Account")


class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=True)
    opportunity_id = Column(Integer, ForeignKey("opportunities.id"), nullable=True)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String(20), nullable=False, default="planning")
    # planning | in_progress | blocked | delivered | closed
    start_date = Column(Date)
    end_date = Column(Date)
    percent_complete = Column(Float, nullable=False, default=0)
    health = Column(String(10), nullable=False, default="green")  # green | yellow | red
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    account = relationship("Account", back_populates="projects")
    manager = relationship("User")
    milestones = relationship(
        "Milestone", back_populates="project", cascade="all, delete-orphan", order_by="Milestone.due_date"
    )


class Milestone(Base):
    __tablename__ = "milestones"
    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    due_date = Column(Date)
    is_done = Column(Boolean, nullable=False, default=False)

    project = relationship("Project", back_populates="milestones")


class Activity(Base):
    __tablename__ = "activities"
    id = Column(Integer, primary_key=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    type = Column(String(15), nullable=False, default="task")
    # call | meeting | email | whatsapp | task | note
    subject = Column(String(255), nullable=False)
    description = Column(Text)
    due_date = Column(DateTime(timezone=True))
    is_done = Column(Boolean, nullable=False, default=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True, index=True)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=True, index=True)
    opportunity_id = Column(Integer, ForeignKey("opportunities.id"), nullable=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User")
    account = relationship("Account")
    contact = relationship("Contact")
    opportunity = relationship("Opportunity")
    project = relationship("Project")


class SalesTarget(Base):
    __tablename__ = "sales_targets"
    id = Column(Integer, primary_key=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    year = Column(Integer, nullable=False)
    quarter = Column(Integer, nullable=False)  # 1..4
    target_amount = Column(Float, nullable=False, default=0)  # in org base currency

    user = relationship("User")


class AuditLog(Base):
    __tablename__ = "audit_log"
    id = Column(Integer, primary_key=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    entity_type = Column(String(30), nullable=False, index=True)  # opportunity | sale | ...
    entity_id = Column(Integer, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(15), nullable=False)  # create | update | delete | stage_change
    changes = Column(JSON)  # {field: {"old": ..., "new": ...}}
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")
