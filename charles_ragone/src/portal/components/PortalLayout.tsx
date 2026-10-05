import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../useAuth";

export default function PortalLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-base-100">
      <div className="navbar bg-base-200 px-6 shadow-sm">
        <div className="flex-1">
          <Link to="/" className="text-lg font-semibold">
            Portal
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/billing" className="btn btn-ghost btn-sm">
            Billing
          </Link>
          {user?.role === "admin" && (
            <>
              <Link to="/admin/users" className="btn btn-ghost btn-sm">
                Users
              </Link>
              <Link to="/admin/recurring-payments" className="btn btn-ghost btn-sm">
                Recurring Payments
              </Link>
              <Link to="/admin/payment-requests" className="btn btn-ghost btn-sm">
                Payment Requests
              </Link>
              <Link to="/admin/rotation" className="btn btn-ghost btn-sm">
                Rotation
              </Link>
            </>
          )}
          <span className="text-sm opacity-70">{user?.username}</span>
          <button className="btn btn-sm" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </div>
      <main className="p-6">{children}</main>
    </div>
  );
}
