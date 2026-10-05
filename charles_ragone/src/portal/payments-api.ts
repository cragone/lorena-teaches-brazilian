import { apiFetch } from "./api";
import type { PaymentCategory, PaymentRequest, RecurringPayment } from "./types";

export function formatCents(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export async function fetchStripeConfig() {
  return apiFetch<{ publishable_key: string }>("/stripe/config");
}

export async function fetchMyPayments() {
  return apiFetch<{ recurring_payments: RecurringPayment[]; payment_requests: PaymentRequest[] }>("/payments/me");
}

export async function payPaymentRequest(id: number) {
  return apiFetch<{ client_secret: string }>(`/payments/requests/${id}/pay`, { method: "POST" });
}

export async function fetchRecurringPayments() {
  return apiFetch<{ recurring_payments: RecurringPayment[] }>("/admin/payments/recurring");
}

export async function createRecurringPayment(input: {
  user_id: number;
  category: PaymentCategory;
  amount_cents: number;
  day_of_month: number;
}) {
  return apiFetch<{ recurring_payment: RecurringPayment }>("/admin/payments/recurring", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function setRecurringPaymentActive(id: number, active: boolean) {
  return apiFetch<{ recurring_payment: RecurringPayment }>(`/admin/payments/recurring/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ active }),
  });
}

export async function fetchPaymentRequests() {
  return apiFetch<{ payment_requests: PaymentRequest[] }>("/admin/payments/requests");
}

export async function createPaymentRequest(input: {
  user_id: number;
  category: PaymentCategory;
  amount_cents: number;
  description: string;
}) {
  return apiFetch<{ payment_request: PaymentRequest }>("/admin/payments/requests", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function deletePaymentRequest(id: number) {
  return apiFetch<void>(`/admin/payments/requests/${id}`, { method: "DELETE" });
}
