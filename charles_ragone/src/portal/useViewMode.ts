import { useContext } from "react";
import { ViewModeContext, type ViewModeContextValue } from "./view-mode-context";

export function useViewMode(): ViewModeContextValue {
  const ctx = useContext(ViewModeContext);
  if (!ctx) {
    throw new Error("useViewMode must be used within a ViewModeProvider");
  }
  return ctx;
}
