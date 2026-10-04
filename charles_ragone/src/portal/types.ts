export type Role = "user" | "admin";

export interface User {
  id: number;
  username: string;
  email: string;
  role: Role;
  disabled_at?: string | null;
  created_at: string;
}
