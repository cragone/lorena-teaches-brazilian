-- +goose Up
CREATE TABLE rotation_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
    position INTEGER NOT NULL,
    active BOOLEAN NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rotation_members_active_position ON rotation_members (active, position);

CREATE TABLE rotation_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    amount_cents INTEGER NOT NULL DEFAULT 10000,
    currency TEXT NOT NULL DEFAULT 'usd',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO rotation_settings (id, amount_cents, currency) VALUES (1, 10000, 'usd');

CREATE TABLE rotation_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    month TEXT NOT NULL UNIQUE,
    rotation_member_id INTEGER NOT NULL REFERENCES rotation_members(id),
    member_position INTEGER NOT NULL,
    resolution TEXT NOT NULL DEFAULT 'pending' CHECK (resolution IN ('pending', 'waived', 'charged')),
    notes TEXT,
    payment_request_id INTEGER REFERENCES payment_requests(id),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rotation_assignments_payment_request_id ON rotation_assignments (payment_request_id);

-- +goose Down
DROP TABLE rotation_assignments;
DROP TABLE rotation_settings;
DROP TABLE rotation_members;
