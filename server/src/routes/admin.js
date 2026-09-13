import { Router } from "express";
import { db } from "../db.js";

export const adminRouter = Router();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

function requireAdmin(req, res, next) {
  if (!ADMIN_PASSWORD) {
    return res.status(503).json({ error: "Admin access is not configured on this server." });
  }
  const provided = req.header("x-admin-password") || "";
  if (provided !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Invalid admin password." });
  }
  next();
}

adminRouter.post("/login", (req, res) => {
  if (!ADMIN_PASSWORD) {
    return res.status(503).json({ error: "Admin access is not configured on this server." });
  }
  const { password } = req.body ?? {};
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Invalid admin password." });
  }
  res.json({ ok: true });
});

adminRouter.use(requireAdmin);

adminRouter.get("/bookings", (req, res) => {
  const bookings = db
    .prepare(
      `SELECT b.*, s.name AS service_name, s.duration_minutes, s.price_cents
       FROM bookings b JOIN services s ON s.id = b.service_id
       ORDER BY b.date DESC, b.start_time DESC`,
    )
    .all();
  res.json({ bookings });
});

adminRouter.patch("/bookings/:id", (req, res) => {
  const { status } = req.body ?? {};
  if (!["pending", "confirmed", "cancelled"].includes(status)) {
    return res.status(400).json({ error: "status must be pending, confirmed, or cancelled." });
  }
  const result = db
    .prepare("UPDATE bookings SET status = ? WHERE id = ?")
    .run(status, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "Booking not found." });
  res.json({ ok: true });
});

adminRouter.get("/blocked-dates", (req, res) => {
  const dates = db
    .prepare("SELECT * FROM blocked_dates ORDER BY date ASC")
    .all();
  res.json({ dates });
});

adminRouter.post("/blocked-dates", (req, res) => {
  const { date, reason } = req.body ?? {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) {
    return res.status(400).json({ error: "A valid date (YYYY-MM-DD) is required." });
  }
  try {
    db.prepare("INSERT INTO blocked_dates (date, reason) VALUES (?, ?)").run(
      date,
      reason ? String(reason) : null,
    );
  } catch {
    return res.status(409).json({ error: "That date is already blocked." });
  }
  res.status(201).json({ ok: true });
});

adminRouter.delete("/blocked-dates/:id", (req, res) => {
  const result = db
    .prepare("DELETE FROM blocked_dates WHERE id = ?")
    .run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "Not found." });
  res.json({ ok: true });
});
