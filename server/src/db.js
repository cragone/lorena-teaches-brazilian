import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR || path.join(__dirname, "..", "data");
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "lorena.sqlite");
export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    price_cents INTEGER NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS availability_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    weekday INTEGER NOT NULL,        -- 0 = Sunday .. 6 = Saturday
    start_time TEXT NOT NULL,        -- 'HH:MM' 24h, America/New_York
    end_time TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS blocked_dates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT UNIQUE NOT NULL,       -- 'YYYY-MM-DD'
    reason TEXT
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference TEXT UNIQUE NOT NULL,
    service_id INTEGER NOT NULL REFERENCES services(id),
    date TEXT NOT NULL,              -- 'YYYY-MM-DD'
    start_time TEXT NOT NULL,        -- 'HH:MM'
    end_time TEXT NOT NULL,
    client_name TEXT NOT NULL,
    client_email TEXT NOT NULL,
    client_phone TEXT,
    language_pair TEXT NOT NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- pending | confirmed | cancelled
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date);
`);

function seedServices() {
  const count = db.prepare("SELECT COUNT(*) AS n FROM services").get().n;
  if (count > 0) return;

  const insert = db.prepare(`
    INSERT INTO services (slug, name, description, duration_minutes, price_cents, sort_order)
    VALUES (@slug, @name, @description, @duration_minutes, @price_cents, @sort_order)
  `);

  const services = [
    {
      slug: "consultation",
      name: "Free 15-Minute Consultation",
      description:
        "A quick call to talk through what you need interpreted, check language pairs, and confirm Lorena is the right fit.",
      duration_minutes: 15,
      price_cents: 0,
      sort_order: 0,
    },
    {
      slug: "general",
      name: "General & Business Interpreting",
      description:
        "Live Portuguese <> English interpreting for meetings, calls, interviews, and everyday business conversations.",
      duration_minutes: 60,
      price_cents: 9000,
      sort_order: 1,
    },
    {
      slug: "medical",
      name: "Medical Appointment Interpreting",
      description:
        "Clear, accurate interpreting for medical appointments and telehealth visits, handled with care and confidentiality.",
      duration_minutes: 60,
      price_cents: 10000,
      sort_order: 2,
    },
    {
      slug: "legal",
      name: "Legal & Official Interpreting",
      description:
        "Interpreting support for depositions, legal calls, and official proceedings that require precision.",
      duration_minutes: 60,
      price_cents: 12000,
      sort_order: 3,
    },
    {
      slug: "document-review",
      name: "Document Translation Review",
      description:
        "A working session to review and go over a translated document line by line, in plain spoken Portuguese or English.",
      duration_minutes: 45,
      price_cents: 7500,
      sort_order: 4,
    },
  ];

  const insertMany = db.transaction((rows) => {
    for (const row of rows) insert.run(row);
  });
  insertMany(services);
}

function seedAvailability() {
  const count = db.prepare("SELECT COUNT(*) AS n FROM availability_rules").get().n;
  if (count > 0) return;

  const insert = db.prepare(`
    INSERT INTO availability_rules (weekday, start_time, end_time)
    VALUES (?, ?, ?)
  `);

  const insertMany = db.transaction(() => {
    // Monday - Friday, 9:00 - 17:00 America/New_York
    for (const weekday of [1, 2, 3, 4, 5]) {
      insert.run(weekday, "09:00", "17:00");
    }
    // Saturday morning, 10:00 - 13:00
    insert.run(6, "10:00", "13:00");
  });
  insertMany();
}

seedServices();
seedAvailability();
