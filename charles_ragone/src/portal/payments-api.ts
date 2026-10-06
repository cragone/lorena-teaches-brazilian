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

// Reconciles a payment request against Stripe's current PaymentIntent
// status right after the client confirms, instead of waiting on the async
// webhook (which can lag, or in local dev, never arrive at all).
export async function syncPaymentRequest(id: number) {
  return apiFetch<{ payment_request: PaymentRequest }>(`/payments/requests/${id}/sync`, { method: "POST" });
}

export async function fetchRecurringPayments() {
  return apiFetch<{ recurring_payments: RecurringPayment[] }>("/admin/payments/recurring");
}

export async function createRecurringPayment(input: {
  user_id?: number;
  unit_id?: number;
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
  user_id?: number;
  unit_id?: number;
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

// Published Stripe processing rates, shown to the payer before they confirm.
// Card: 2.9% + $0.30. ACH bank debit: 0.8%, capped at $5.00.
export type PayMethod = "card" | "us_bank_account";

export function estimateFeeCents(method: PayMethod, amountCents: number): number {
  if (method === "us_bank_account") return Math.min(Math.round(amountCents * 0.008), 500);
  return Math.round(amountCents * 0.029) + 30;
}

export const FEE_DESCRIPTIONS: Record<PayMethod, string> = {
  card: "2.9% + $0.30",
  us_bank_account: "0.8%, max $5.00",
};
