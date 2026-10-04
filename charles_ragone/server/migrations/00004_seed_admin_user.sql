-- +goose Up
-- Seeds the first admin account. Password is the literal string "temp" —
-- change it immediately after first login via the admin panel.
INSERT INTO users (username, email, password_hash, role, created_at, updated_at)
VALUES (
    'charlie',
    'ragonecharlie@gmail.com',
    '$2a$10$YqioBKJSsGKnSNbRqCvoVulHKwUiQ4tOGQ4b.f/8LvUnJa.PkJNGC',
    'admin',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- +goose Down
DELETE FROM users WHERE email = 'ragonecharlie@gmail.com';
