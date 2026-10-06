export type Role = "user" | "admin";

export interface User {
  id: number;
  username: string;
  email: string;
  role: Role;
  disabled_at?: string | null;
  created_at: string;
}

export type PaymentCategory = "rent" | "wifi" | "national_grid" | "other" | "property_management";

export const PAYMENT_CATEGORIES: { value: PaymentCategory; label: string }[] = [
  { value: "rent", label: "Rent" },
  { value: "wifi", label: "WiFi" },
  { value: "national_grid", label: "National Grid" },
  { value: "other", label: "Other" },
  { value: "property_management", label: "Property management" },
];

export type PaymentStatus = "pending" | "processing" | "succeeded" | "failed" | "canceled";

export interface Unit {
  id: number;
  name: string;
  members: { user_id: number; username: string; email: string }[];
}

export interface RecurringPayment {
  id: number;
  user_id?: number;
  username?: string;
  unit_id?: number;
  unit_name?: string;
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
  user_id?: number;
  username?: string;
  unit_id?: number;
  unit_name?: string;
  paid_by?: string;
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

export type RotationResolution = "pending" | "waived" | "charged";

export interface RotationMember {
  id: number;
  user_id: number;
  username?: string;
  position: number;
  active: boolean;
}

export interface RotationSettings {
  amount_cents: number;
  currency: string;
}

export interface RotationAssignment {
  id: number;
  month: string;
  rotation_member_id: number;
  user_id: number;
  username?: string;
  resolution: RotationResolution;
  notes?: string;
  payment_request_id?: number | null;
  payment_status?: PaymentStatus | "";
  created_at: string;
}
