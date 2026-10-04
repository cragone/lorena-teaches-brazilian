export type Role = "user" | "admin";

export interface User {
  id: number;
  username: string;
  email: string;
  role: Role;
  disabled_at?: string | null;
  created_at: string;
}

export type PaymentCategory = "rent" | "wifi" | "national_grid" | "other";

export const PAYMENT_CATEGORIES: { value: PaymentCategory; label: string }[] = [
  { value: "rent", label: "Rent" },
  { value: "wifi", label: "WiFi" },
  { value: "national_grid", label: "National Grid" },
  { value: "other", label: "Other" },
];

export type PaymentStatus = "pending" | "processing" | "succeeded" | "failed" | "canceled";

export interface RecurringPayment {
  id: number;
  user_id: number;
  username?: string;
  category: PaymentCategory;
  amount_cents: number;
  currency: string;
  day_of_month: number;
  active: boolean;
  next_run_at: string;
  last_run_at?: string | null;
  created_at: string;
}

export interface PaymentRequest {
  id: number;
  user_id: number;
  username?: string;
  category: PaymentCategory;
  amount_cents: number;
  currency: string;
  description: string;
  source: "manual" | "recurring";
  status: PaymentStatus;
  failure_reason?: string;
  created_at: string;
  paid_at?: string | null;
}
