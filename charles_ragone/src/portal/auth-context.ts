import { createContext } from "react";
import type { User } from "./types";

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (usernameOrEmail: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
