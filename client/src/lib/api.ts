const BASE_URL = import.meta.env.VITE_API_URL || "/api";

export type Service = {
  id: number;
  slug: string;
  name: string;
  description: string;
  duration_minutes: number;
  price_cents: number;
};

export type Slot = {
  startTime: string;
  endTime: string;
};

export type Booking = {
  id: number;
  reference: string;
  service_id: number;
  service_name: string;
  date: string;
  start_time: string;
  end_time: string;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  language_pair: string;
  notes: string | null;
  status: "pending" | "confirmed" | "cancelled";
  created_at: string;
  duration_minutes?: number;
  price_cents?: number;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // no body
  }

  if (!res.ok) {
    const message =
      (body as { error?: string } | null)?.error || `Request failed (${res.status})`;
    throw new Error(message);
  }

  return body as T;
}

export function fetchServices() {
  return request<{ services: Service[] }>("/services");
}

export function fetchAvailability(date: string, serviceId: number) {
  return request<{ date: string; serviceId: number; slots: Slot[] }>(
    `/availability?date=${encodeURIComponent(date)}&serviceId=${serviceId}`,
  );
}

export type CreateBookingInput = {
  serviceId: number;
  date: string;
  startTime: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  languagePair: string;
  notes?: string;
};

export function createBooking(input: CreateBookingInput) {
  return request<{ booking: Booking }>("/bookings", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function adminLogin(password: string) {
  return request<{ ok: true }>("/admin/login", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export function fetchAdminBookings(password: string) {
  return request<{ bookings: Booking[] }>("/admin/bookings", {
    headers: { "x-admin-password": password },
  });
}

export function updateBookingStatus(
  password: string,
  id: number,
  status: Booking["status"],
) {
  return request<{ ok: true }>(`/admin/bookings/${id}`, {
    method: "PATCH",
    headers: { "x-admin-password": password },
    body: JSON.stringify({ status }),
  });
}

export function formatPrice(cents: number) {
  if (cents === 0) return "Free";
  return `$${(cents / 100).toFixed(0)}`;
}
