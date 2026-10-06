import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../useAuth";
import { useViewMode } from "../useViewMode";
import type { ViewMode } from "../view-mode-context";

function YatesMark() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 11.5 12 4l9 7.5" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.5 10v9a1 1 0 0 0 1 1H10v-5a2 2 0 1 1 4 0v5h3.5a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

function ViewModeToggle({ viewMode, onChange }: { viewMode: ViewMode; onChange: (mode: ViewMode) => void }) {
  return (
    <div className="join" role="group" aria-label="Viewing as">
      <button
        type="button"
        className={`btn btn-xs join-item ${viewMode === "admin" ? "btn-primary" : "btn-ghost"}`}
        aria-pressed={viewMode === "admin"}
        onClick={() => onChange("admin")}
      >
        Admin
      </button>
      <button
        type="button"
        className={`btn btn-xs join-item ${viewMode === "tenant" ? "btn-primary" : "btn-ghost"}`}
        aria-pressed={viewMode === "tenant"}
        onClick={() => onChange("tenant")}
      >
        Tenant
      </button>
    </div>
  );
}

export default function PortalLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { viewMode, setViewMode } = useViewMode();
  const navigate = useNavigate();
  const location = useLocation();

  const isAdmin = user?.role === "admin";
  const effectiveAdmin = isAdmin && viewMode === "admin";

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  function handleViewModeChange(mode: ViewMode) {
    setViewMode(mode);
    if (mode === "tenant" && location.pathname.startsWith("/admin")) {
      navigate("/", { replace: true });
    }
  }

  const links = [
    { to: "/billing", label: "Billing" },
    ...(effectiveAdmin
      ? [
          { to: "/admin/users", label: "Users" },
          { to: "/admin/units", label: "Units" },
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
    <div className="flex min-h-dvh flex-col bg-base-100">
      <div className="navbar border-b border-base-300 bg-base-200 px-3 sm:px-6">
        <div className="flex-1">
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold text-primary">
            <YatesMark />
            Yates
          </Link>
        </div>

        {/* Desktop nav */}
        <div className="hidden flex-wrap items-center justify-end gap-3 lg:flex">
          {isAdmin && <ViewModeToggle viewMode={viewMode} onChange={handleViewModeChange} />}
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
            {isAdmin && (
              <li className="py-1">
                <div className="flex items-center justify-between px-2">
                  <span className="text-xs opacity-60">Viewing as</span>
                  <ViewModeToggle viewMode={viewMode} onChange={handleViewModeChange} />
                </div>
              </li>
            )}
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
      <main className="flex-1 p-4 sm:p-6">{children}</main>
      <footer className="footer footer-center border-t border-base-300 bg-base-200 p-4 text-xs opacity-60">
        <p>Yates &middot; {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
