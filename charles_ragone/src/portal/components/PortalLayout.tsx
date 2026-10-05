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

  const links = [
    { to: "/billing", label: "Billing" },
    ...(user?.role === "admin"
      ? [
          { to: "/admin/users", label: "Users" },
          { to: "/admin/recurring-payments", label: "Recurring Payments" },
          { to: "/admin/payment-requests", label: "Payment Requests" },
          { to: "/admin/rotation", label: "Rotation" },
        ]
      : []),
  ];

  function closeMenu() {
    (document.activeElement as HTMLElement | null)?.blur();
  }

  return (
    <div className="min-h-dvh bg-base-100">
      <div className="navbar bg-base-200 px-3 shadow-sm sm:px-6">
        <div className="flex-1">
          <Link to="/" className="text-lg font-semibold">
            Portal
          </Link>
        </div>

        {/* Desktop nav */}
        <div className="hidden flex-wrap items-center justify-end gap-2 lg:flex">
          {links.map((l) => (
            <Link key={l.to} to={l.to} className="btn btn-ghost btn-sm">
              {l.label}
            </Link>
          ))}
          <span className="text-sm opacity-70">{user?.username}</span>
          <button className="btn btn-sm" onClick={handleLogout}>
            Log out
          </button>
        </div>

        {/* Mobile / tablet menu */}
        <div className="dropdown dropdown-end lg:hidden">
          <button tabIndex={0} className="btn btn-ghost" aria-label="Open menu">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <ul
            tabIndex={0}
            className="menu dropdown-content z-10 mt-2 w-64 rounded-box bg-base-200 p-2 shadow-lg"
          >
            {user?.username && <li className="menu-title">{user.username}</li>}
            {links.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="py-3" onClick={closeMenu}>
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <button className="py-3" onClick={handleLogout}>
                Log out
              </button>
            </li>
          </ul>
        </div>
      </div>
      <main className="p-4 sm:p-6">{children}</main>
    </div>
  );
}
