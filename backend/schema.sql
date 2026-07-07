-- MaxSales CRM — PostgreSQL schema (generated from SQLAlchemy models)

CREATE TABLE organizations (
	id SERIAL NOT NULL, 
	name VARCHAR(120) NOT NULL, 
	base_currency VARCHAR(3) NOT NULL, 
	stale_days INTEGER NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id)
);

CREATE TABLE users (
	id SERIAL NOT NULL, 
	email VARCHAR(255) NOT NULL, 
	hashed_password VARCHAR(255) NOT NULL, 
	full_name VARCHAR(120) NOT NULL, 
	language VARCHAR(5) NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id)
);
CREATE UNIQUE INDEX ix_users_email ON users (email);

CREATE TABLE accounts (
	id SERIAL NOT NULL, 
	org_id INTEGER NOT NULL, 
	name VARCHAR(200) NOT NULL, 
	industry VARCHAR(100), 
	segment VARCHAR(20), 
	country VARCHAR(80), 
	website VARCHAR(255), 
	tax_id VARCHAR(60), 
	owner_id INTEGER, 
	status VARCHAR(20) NOT NULL, 
	annual_revenue FLOAT, 
	notes TEXT, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	FOREIGN KEY(org_id) REFERENCES organizations (id), 
	FOREIGN KEY(owner_id) REFERENCES users (id)
);
CREATE INDEX ix_accounts_org_id ON accounts (org_id);
CREATE INDEX ix_accounts_name ON accounts (name);

CREATE TABLE audit_log (
	id SERIAL NOT NULL, 
	org_id INTEGER NOT NULL, 
	entity_type VARCHAR(30) NOT NULL, 
	entity_id INTEGER NOT NULL, 
	user_id INTEGER, 
	action VARCHAR(15) NOT NULL, 
	changes JSON, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	FOREIGN KEY(org_id) REFERENCES organizations (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);
CREATE INDEX ix_audit_log_entity_type ON audit_log (entity_type);
CREATE INDEX ix_audit_log_org_id ON audit_log (org_id);
CREATE INDEX ix_audit_log_entity_id ON audit_log (entity_id);

CREATE TABLE currency_rates (
	id SERIAL NOT NULL, 
	org_id INTEGER NOT NULL, 
	code VARCHAR(3) NOT NULL, 
	rate_to_base FLOAT NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(org_id) REFERENCES organizations (id)
);
CREATE INDEX ix_currency_rates_org_id ON currency_rates (org_id);

CREATE TABLE memberships (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	org_id INTEGER NOT NULL, 
	role VARCHAR(20) NOT NULL, 
	manager_id INTEGER, 
	is_owner BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	CONSTRAINT uq_membership_user_org UNIQUE (user_id, org_id), 
	FOREIGN KEY(user_id) REFERENCES users (id), 
	FOREIGN KEY(org_id) REFERENCES organizations (id), 
	FOREIGN KEY(manager_id) REFERENCES users (id)
);
CREATE INDEX ix_memberships_user_id ON memberships (user_id);
CREATE INDEX ix_memberships_org_id ON memberships (org_id);

CREATE TABLE pipeline_stages (
	id SERIAL NOT NULL, 
	org_id INTEGER NOT NULL, 
	name VARCHAR(80) NOT NULL, 
	sort_order INTEGER NOT NULL, 
	probability FLOAT NOT NULL, 
	is_won BOOLEAN NOT NULL, 
	is_lost BOOLEAN NOT NULL, 
	requires_amount BOOLEAN NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(org_id) REFERENCES organizations (id)
);
CREATE INDEX ix_pipeline_stages_org_id ON pipeline_stages (org_id);

CREATE TABLE products (
	id SERIAL NOT NULL, 
	org_id INTEGER NOT NULL, 
	name VARCHAR(150) NOT NULL, 
	category VARCHAR(100), 
	unit_price FLOAT NOT NULL, 
	currency VARCHAR(3) NOT NULL, 
	is_recurring BOOLEAN NOT NULL, 
	description TEXT, 
	is_active BOOLEAN NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(org_id) REFERENCES organizations (id)
);
CREATE INDEX ix_products_org_id ON products (org_id);

CREATE TABLE sales_targets (
	id SERIAL NOT NULL, 
	org_id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	year INTEGER NOT NULL, 
	quarter INTEGER NOT NULL, 
	target_amount FLOAT NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(org_id) REFERENCES organizations (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);
CREATE INDEX ix_sales_targets_org_id ON sales_targets (org_id);

CREATE TABLE contacts (
	id SERIAL NOT NULL, 
	org_id INTEGER NOT NULL, 
	account_id INTEGER NOT NULL, 
	name VARCHAR(150) NOT NULL, 
	role_title VARCHAR(120), 
	email VARCHAR(255), 
	phone VARCHAR(60), 
	whatsapp VARCHAR(60), 
	linkedin VARCHAR(255), 
	is_decision_maker BOOLEAN NOT NULL, 
	preferred_language VARCHAR(5), 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	FOREIGN KEY(org_id) REFERENCES organizations (id), 
	FOREIGN KEY(account_id) REFERENCES accounts (id)
);
CREATE INDEX ix_contacts_org_id ON contacts (org_id);
CREATE INDEX ix_contacts_email ON contacts (email);
CREATE INDEX ix_contacts_account_id ON contacts (account_id);

CREATE TABLE opportunities (
	id SERIAL NOT NULL, 
	org_id INTEGER NOT NULL, 
	name VARCHAR(200) NOT NULL, 
	account_id INTEGER NOT NULL, 
	primary_contact_id INTEGER, 
	owner_id INTEGER, 
	amount FLOAT, 
	currency VARCHAR(3) NOT NULL, 
	probability FLOAT NOT NULL, 
	expected_close_date DATE, 
	source VARCHAR(30), 
	product_line VARCHAR(100), 
	competitors VARCHAR(255), 
	next_step VARCHAR(255), 
	stage_id INTEGER NOT NULL, 
	status VARCHAR(10) NOT NULL, 
	loss_reason VARCHAR(255), 
	stage_entered_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	last_activity_at TIMESTAMP WITH TIME ZONE, 
	closed_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	FOREIGN KEY(org_id) REFERENCES organizations (id), 
	FOREIGN KEY(account_id) REFERENCES accounts (id), 
	FOREIGN KEY(primary_contact_id) REFERENCES contacts (id), 
	FOREIGN KEY(owner_id) REFERENCES users (id), 
	FOREIGN KEY(stage_id) REFERENCES pipeline_stages (id)
);
CREATE INDEX ix_opportunities_account_id ON opportunities (account_id);
CREATE INDEX ix_opportunities_org_id ON opportunities (org_id);

CREATE TABLE opportunity_line_items (
	id SERIAL NOT NULL, 
	opportunity_id INTEGER NOT NULL, 
	product_id INTEGER NOT NULL, 
	quantity FLOAT NOT NULL, 
	unit_price FLOAT NOT NULL, 
	discount_pct FLOAT NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(opportunity_id) REFERENCES opportunities (id), 
	FOREIGN KEY(product_id) REFERENCES products (id)
);
CREATE INDEX ix_opportunity_line_items_opportunity_id ON opportunity_line_items (opportunity_id);

CREATE TABLE sales (
	id SERIAL NOT NULL, 
	org_id INTEGER NOT NULL, 
	opportunity_id INTEGER, 
	account_id INTEGER NOT NULL, 
	contract_value FLOAT NOT NULL, 
	currency VARCHAR(3) NOT NULL, 
	billing_type VARCHAR(15) NOT NULL, 
	mrr FLOAT, 
	start_date DATE, 
	term_months INTEGER, 
	invoicing_status VARCHAR(20) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	FOREIGN KEY(org_id) REFERENCES organizations (id), 
	FOREIGN KEY(opportunity_id) REFERENCES opportunities (id), 
	FOREIGN KEY(account_id) REFERENCES accounts (id)
);
CREATE INDEX ix_sales_account_id ON sales (account_id);
CREATE INDEX ix_sales_org_id ON sales (org_id);

CREATE TABLE stage_history (
	id SERIAL NOT NULL, 
	opportunity_id INTEGER NOT NULL, 
	from_stage_id INTEGER, 
	to_stage_id INTEGER NOT NULL, 
	changed_by_id INTEGER, 
	changed_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	FOREIGN KEY(opportunity_id) REFERENCES opportunities (id), 
	FOREIGN KEY(from_stage_id) REFERENCES pipeline_stages (id), 
	FOREIGN KEY(to_stage_id) REFERENCES pipeline_stages (id), 
	FOREIGN KEY(changed_by_id) REFERENCES users (id)
);
CREATE INDEX ix_stage_history_opportunity_id ON stage_history (opportunity_id);

CREATE TABLE projects (
	id SERIAL NOT NULL, 
	org_id INTEGER NOT NULL, 
	name VARCHAR(200) NOT NULL, 
	account_id INTEGER NOT NULL, 
	sale_id INTEGER, 
	opportunity_id INTEGER, 
	manager_id INTEGER, 
	status VARCHAR(20) NOT NULL, 
	start_date DATE, 
	end_date DATE, 
	percent_complete FLOAT NOT NULL, 
	health VARCHAR(10) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	FOREIGN KEY(org_id) REFERENCES organizations (id), 
	FOREIGN KEY(account_id) REFERENCES accounts (id), 
	FOREIGN KEY(sale_id) REFERENCES sales (id), 
	FOREIGN KEY(opportunity_id) REFERENCES opportunities (id), 
	FOREIGN KEY(manager_id) REFERENCES users (id)
);
CREATE INDEX ix_projects_account_id ON projects (account_id);
CREATE INDEX ix_projects_org_id ON projects (org_id);

CREATE TABLE activities (
	id SERIAL NOT NULL, 
	org_id INTEGER NOT NULL, 
	type VARCHAR(15) NOT NULL, 
	subject VARCHAR(255) NOT NULL, 
	description TEXT, 
	due_date TIMESTAMP WITH TIME ZONE, 
	is_done BOOLEAN NOT NULL, 
	owner_id INTEGER, 
	account_id INTEGER, 
	contact_id INTEGER, 
	opportunity_id INTEGER, 
	project_id INTEGER, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	FOREIGN KEY(org_id) REFERENCES organizations (id), 
	FOREIGN KEY(owner_id) REFERENCES users (id), 
	FOREIGN KEY(account_id) REFERENCES accounts (id), 
	FOREIGN KEY(contact_id) REFERENCES contacts (id), 
	FOREIGN KEY(opportunity_id) REFERENCES opportunities (id), 
	FOREIGN KEY(project_id) REFERENCES projects (id)
);
CREATE INDEX ix_activities_opportunity_id ON activities (opportunity_id);
CREATE INDEX ix_activities_project_id ON activities (project_id);
CREATE INDEX ix_activities_contact_id ON activities (contact_id);
CREATE INDEX ix_activities_org_id ON activities (org_id);
CREATE INDEX ix_activities_account_id ON activities (account_id);

CREATE TABLE milestones (
	id SERIAL NOT NULL, 
	project_id INTEGER NOT NULL, 
	name VARCHAR(200) NOT NULL, 
	due_date DATE, 
	is_done BOOLEAN NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(project_id) REFERENCES projects (id)
);
CREATE INDEX ix_milestones_project_id ON milestones (project_id);
