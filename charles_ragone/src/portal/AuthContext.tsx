import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ApiError, apiFetch } from "./api";
import { AuthContext } from "./auth-context";
import type { User } from "./types";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await apiFetch<{ user: User }>("/auth/me");
      setUser(data.user);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
        return;
      }
      throw err;
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await apiFetch("/auth/csrf");
        await refresh();
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  const login = useCallback(async (usernameOrEmail: string, password: string) => {
    const data = await apiFetch<{ user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username_or_email: usernameOrEmail, password }),
    });
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await apiFetch("/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}
