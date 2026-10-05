import { createContext } from "react";

export type ViewMode = "admin" | "tenant";

export interface ViewModeContextValue {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}

export const ViewModeContext = createContext<ViewModeContextValue | null>(null);
