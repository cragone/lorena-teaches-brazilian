import { db } from "./db.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MIN_NOTICE_HOURS = 2;
const MAX_DAYS_AHEAD = 60;

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function toHHMM(minutes) {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function isValidDateString(date) {
  if (!DATE_RE.test(date)) return false;
  const d = new Date(`${date}T00:00:00`);
  return !Number.isNaN(d.getTime());
}

export function isDateBookable(date) {
  const today = new Date();
  const target = new Date(`${date}T00:00:00`);
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + MAX_DAYS_AHEAD);

  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  return target >= startOfToday && target <= maxDate;
}

/**
 * Returns available start times ('HH:MM') for a given service on a given date,
 * honoring weekly availability rules, blocked dates, existing bookings, and
 * a minimum booking-notice window.
 */
export function getAvailableSlots(date, serviceId) {
  if (!isValidDateString(date) || !isDateBookable(date)) return [];

  const service = db
    .prepare("SELECT * FROM services WHERE id = ? AND active = 1")
    .get(serviceId);
  if (!service) return [];

  const blocked = db
    .prepare("SELECT 1 FROM blocked_dates WHERE date = ?")
    .get(date);
  if (blocked) return [];

  const weekday = new Date(`${date}T00:00:00`).getDay();
  const rules = db
    .prepare("SELECT * FROM availability_rules WHERE weekday = ?")
    .all(weekday);
  if (rules.length === 0) return [];

  const existingBookings = db
    .prepare(
      `SELECT start_time, end_time FROM bookings
       WHERE date = ? AND status != 'cancelled'`,
    )
    .all(date);

  const busy = existingBookings.map((b) => ({
    start: toMinutes(b.start_time),
    end: toMinutes(b.end_time),
  }));

  const duration = service.duration_minutes;
  const slots = [];

  const now = new Date();
  const isToday = date === now.toISOString().slice(0, 10);
  const earliestMinutesToday = isToday
    ? now.getHours() * 60 + now.getMinutes() + MIN_NOTICE_HOURS * 60
    : -Infinity;

  for (const rule of rules) {
    const ruleStart = toMinutes(rule.start_time);
    const ruleEnd = toMinutes(rule.end_time);

    for (
      let start = ruleStart;
      start + duration <= ruleEnd;
      start += duration
    ) {
      const end = start + duration;
      if (isToday && start < earliestMinutesToday) continue;

      const overlaps = busy.some((b) => start < b.end && end > b.start);
      if (overlaps) continue;

      slots.push({ startTime: toHHMM(start), endTime: toHHMM(end) });
    }
  }

  return slots;
}

export function isSlotStillAvailable(date, serviceId, startTime) {
  const slots = getAvailableSlots(date, serviceId);
  return slots.some((s) => s.startTime === startTime);
}
