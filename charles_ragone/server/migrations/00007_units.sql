-- +goose Up
CREATE TABLE units (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE unit_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    unit_id INTEGER NOT NULL REFERENCES units(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_unit_members_unit_user ON unit_members (unit_id, user_id);
CREATE INDEX idx_unit_members_user_id ON unit_members (user_id);

-- Charges can now target a unit (any member may pay) instead of one user,
-- so user_id becomes nullable. SQLite can't drop NOT NULL in place, so both
-- tables are rebuilt.
CREATE TABLE recurring_payments_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    unit_id INTEGER REFERENCES units(id),
    category TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'usd',
    day_of_month INTEGER NOT NULL CHECK (day_of_month BETWEEN 1 AND 28),
    active BOOLEAN NOT NULL DEFAULT 1,
    next_run_at DATETIME NOT NULL,
    last_run_at DATETIME,
    created_by_id INTEGER NOT NULL REFERENCES users(id),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (user_id IS NOT NULL OR unit_id IS NOT NULL)
);
INSERT INTO recurring_payments_new (id, user_id, category, amount_cents, currency, day_of_month, active, next_run_at, last_run_at, created_by_id, created_at, updated_at)
SELECT id, user_id, category, amount_cents, currency, day_of_month, active, next_run_at, last_run_at, created_by_id, created_at, updated_at FROM recurring_payments;

CREATE TABLE payment_requests_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    unit_id INTEGER REFERENCES units(id),
    category TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'usd',
    description TEXT,
    source TEXT NOT NULL CHECK (source IN ('manual', 'recurring')),
    recurring_payment_id INTEGER REFERENCES recurring_payments(id),
    stripe_payment_intent_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'canceled')),
    failure_reason TEXT,
    created_by_id INTEGER REFERENCES users(id),
    paid_by_id INTEGER REFERENCES users(id),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    paid_at DATETIME,
    CHECK (user_id IS NOT NULL OR unit_id IS NOT NULL)
);
INSERT INTO payment_requests_new (id, user_id, category, amount_cents, currency, description, source, recurring_payment_id, stripe_payment_intent_id, status, failure_reason, created_by_id, created_at, updated_at, paid_at)
SELECT id, user_id, category, amount_cents, currency, description, source, recurring_payment_id, stripe_payment_intent_id, status, failure_reason, created_by_id, created_at, updated_at, paid_at FROM payment_requests;

DROP TABLE payment_requests;
DROP TABLE recurring_payments;
ALTER TABLE recurring_payments_new RENAME TO recurring_payments;
ALTER TABLE payment_requests_new RENAME TO payment_requests;

CREATE INDEX idx_recurring_payments_user_id ON recurring_payments (user_id);
CREATE INDEX idx_recurring_payments_unit_id ON recurring_payments (unit_id);
CREATE INDEX idx_recurring_payments_next_run_at ON recurring_payments (next_run_at);
CREATE INDEX idx_payment_requests_user_id ON payment_requests (user_id);
CREATE INDEX idx_payment_requests_unit_id ON payment_requests (unit_id);
CREATE INDEX idx_payment_requests_status ON payment_requests (status);

-- +goose Down
-- Irreversible: unit-targeted charges have no user to fall back to.
SELECT 1;
