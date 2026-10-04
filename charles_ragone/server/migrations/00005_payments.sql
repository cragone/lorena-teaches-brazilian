-- +goose Up
ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;

CREATE TABLE recurring_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    category TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'usd',
    day_of_month INTEGER NOT NULL CHECK (day_of_month BETWEEN 1 AND 28),
    active BOOLEAN NOT NULL DEFAULT 1,
    next_run_at DATETIME NOT NULL,
    last_run_at DATETIME,
    created_by_id INTEGER NOT NULL REFERENCES users(id),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_recurring_payments_user_id ON recurring_payments (user_id);
CREATE INDEX idx_recurring_payments_next_run_at ON recurring_payments (next_run_at);

CREATE TABLE payment_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
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
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    paid_at DATETIME
);

CREATE INDEX idx_payment_requests_user_id ON payment_requests (user_id);
CREATE INDEX idx_payment_requests_status ON payment_requests (status);

CREATE TABLE payment_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stripe_event_id TEXT NOT NULL,
    type TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_payment_events_stripe_event_id ON payment_events (stripe_event_id);

-- +goose Down
DROP TABLE payment_events;
DROP TABLE payment_requests;
DROP TABLE recurring_payments;
ALTER TABLE users DROP COLUMN stripe_customer_id;
