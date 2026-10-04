import { Outlet } from "react-router-dom";
import { useAuth } from "../useAuth";

export default function RequireAdmin() {
  const { user } = useAuth();

  if (user?.role !== "admin") {
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
