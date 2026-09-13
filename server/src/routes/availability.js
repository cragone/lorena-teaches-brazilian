import { Router } from "express";
import { db } from "../db.js";
import { getAvailableSlots, isValidDateString, isDateBookable } from "../slots.js";

export const availabilityRouter = Router();

availabilityRouter.get("/", (req, res) => {
  const { date, serviceId } = req.query;

  if (!date || !isValidDateString(String(date))) {
    return res.status(400).json({ error: "A valid 'date' (YYYY-MM-DD) is required." });
  }
  if (!isDateBookable(String(date))) {
    return res.status(400).json({ error: "Date is outside the bookable window." });
  }

  const service = db
    .prepare("SELECT id FROM services WHERE id = ? AND active = 1")
    .get(Number(serviceId));
  if (!service) {
    return res.status(400).json({ error: "Unknown or inactive service." });
  }

  const slots = getAvailableSlots(String(date), Number(serviceId));
  res.json({ date, serviceId: Number(serviceId), slots });
});
