import { Router } from "express";
import { db } from "../db.js";

export const servicesRouter = Router();

servicesRouter.get("/", (req, res) => {
  const services = db
    .prepare(
      `SELECT id, slug, name, description, duration_minutes, price_cents
       FROM services
       WHERE active = 1
       ORDER BY sort_order ASC`,
    )
    .all();
  res.json({ services });
});
