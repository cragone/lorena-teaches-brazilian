-- +goose Up
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN disabled_at DATETIME;

-- +goose Down
ALTER TABLE users DROP COLUMN disabled_at;
ALTER TABLE users DROP COLUMN role;
