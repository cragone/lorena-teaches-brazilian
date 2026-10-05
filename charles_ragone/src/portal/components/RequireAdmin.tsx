import { Outlet } from "react-router-dom";
import { useAuth } from "../useAuth";
import { useViewMode } from "../useViewMode";

export default function RequireAdmin() {
  const { user } = useAuth();
  const { viewMode } = useViewMode();

  if (user?.role !== "admin" || viewMode === "tenant") {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="alert alert-error max-w-md">
          <span>You don't have access to this page.</span>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
