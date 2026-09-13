import { Router } from "express";
import { customAlphabet } from "nanoid";
import { db } from "../db.js";
import { isSlotStillAvailable, isValidDateString, isDateBookable } from "../slots.js";

export const bookingsRouter = Router();

const nanoid = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 7);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

bookingsRouter.post("/", (req, res) => {
  const {
    serviceId,
    date,
    startTime,
    clientName,
    clientEmail,
    clientPhone,
    languagePair,
    notes,
  } = req.body ?? {};

  if (!Number.isFinite(Number(serviceId))) return badRequest(res, "serviceId is required.");
  if (!date || !isValidDateString(String(date))) return badRequest(res, "A valid date is required.");
  if (!isDateBookable(String(date))) return badRequest(res, "Date is outside the bookable window.");
  if (!/^\d{2}:\d{2}$/.test(String(startTime || ""))) return badRequest(res, "A valid startTime is required.");
  if (!clientName || String(clientName).trim().length < 2) return badRequest(res, "Name is required.");
  if (!clientEmail || !EMAIL_RE.test(String(clientEmail))) return badRequest(res, "A valid email is required.");
  if (!languagePair || String(languagePair).trim().length < 2) return badRequest(res, "Language pair is required.");

  const service = db
    .prepare("SELECT * FROM services WHERE id = ? AND active = 1")
    .get(Number(serviceId));
  if (!service) return badRequest(res, "Unknown or inactive service.");

  if (!isSlotStillAvailable(String(date), Number(serviceId), String(startTime))) {
    return res.status(409).json({ error: "That time slot is no longer available. Please pick another." });
  }

  const [h, m] = String(startTime).split(":").map(Number);
  const endMinutes = h * 60 + m + service.duration_minutes;
  const endTime = `${Math.floor(endMinutes / 60)
    .toString()
    .padStart(2, "0")}:${(endMinutes % 60).toString().padStart(2, "0")}`;

  const reference = `LOR-${nanoid()}`;

  const insert = db.prepare(`
    INSERT INTO bookings
      (reference, service_id, date, start_time, end_time, client_name, client_email, client_phone, language_pair, notes, status)
    VALUES
      (@reference, @service_id, @date, @start_time, @end_time, @client_name, @client_email, @client_phone, @language_pair, @notes, 'pending')
  `);

  try {
    insert.run({
      reference,
      service_id: service.id,
      date: String(date),
      start_time: String(startTime),
      end_time: endTime,
      client_name: String(clientName).trim(),
      client_email: String(clientEmail).trim(),
      client_phone: clientPhone ? String(clientPhone).trim() : null,
      language_pair: String(languagePair).trim(),
      notes: notes ? String(notes).trim() : null,
    });
  } catch {
    return res.status(409).json({ error: "That time slot was just booked. Please pick another." });
  }

  const booking = db
    .prepare(
      `SELECT b.*, s.name AS service_name, s.duration_minutes, s.price_cents
       FROM bookings b JOIN services s ON s.id = b.service_id
       WHERE b.reference = ?`,
    )
    .get(reference);

  res.status(201).json({ booking });
});

bookingsRouter.get("/:reference", (req, res) => {
  const booking = db
    .prepare(
      `SELECT b.reference, b.date, b.start_time, b.end_time, b.status, s.name AS service_name
       FROM bookings b JOIN services s ON s.id = b.service_id
       WHERE b.reference = ?`,
    )
    .get(req.params.reference);

  if (!booking) return res.status(404).json({ error: "Booking not found." });
  res.json({ booking });
});
