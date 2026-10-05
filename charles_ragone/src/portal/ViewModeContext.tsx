import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "./useAuth";
import { ViewModeContext, type ViewMode } from "./view-mode-context";

const STORAGE_KEY = "viewMode";

function readStoredViewMode(): ViewMode {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "tenant" ? "tenant" : "admin";
  } catch {
    return "admin";
  }
}

function writeStoredViewMode(mode: ViewMode) {
  try {
    sessionStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Best-effort convenience only; ignore storage failures (private mode, quota, etc).
  }
}

function clearStoredViewMode() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore - see writeStoredViewMode.
  }
}

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [viewMode, setViewModeState] = useState<ViewMode>(() => readStoredViewMode());
  const lastUserIdRef = useRef<number | null | undefined>(undefined);

  useEffect(() => {
    const currentId = user?.id ?? null;
    if (lastUserIdRef.current === undefined) {
      // First mount: keep whatever was already in sessionStorage for this session.
      lastUserIdRef.current = currentId;
      return;
    }
    if (lastUserIdRef.current !== currentId) {
      lastUserIdRef.current = currentId;
      setViewModeState("admin");
      clearStoredViewMode();
    }
  }, [user]);

  const setViewMode = useCallback((mode: ViewMode) => {
    writeStoredViewMode(mode);
    setViewModeState(mode);
  }, []);

  // Non-admins (or logged-out users) never get a tenant-preview mode, regardless of
  // stale sessionStorage from a previously logged-in admin on the same browser tab.
  const effectiveViewMode: ViewMode = user?.role === "admin" ? viewMode : "admin";

  return (
    <ViewModeContext.Provider value={{ viewMode: effectiveViewMode, setViewMode }}>
      {children}
    </ViewModeContext.Provider>
  );
}
