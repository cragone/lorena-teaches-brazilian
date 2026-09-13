import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  adminLogin,
  fetchAdminBookings,
  updateBookingStatus,
  formatPrice,
  type Booking,
} from "../lib/api";

const STORAGE_KEY = "lorena_admin_password";

export default function AdminPage() {
  const [password, setPassword] = useState(
    () => sessionStorage.getItem(STORAGE_KEY) || "",
  );
  const [authed, setAuthed] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = (pw: string) => {
    setLoading(true);
    setError(null);
    fetchAdminBookings(pw)
      .then((res) => setBookings(res.bookings))
      .catch((err) => setError(err.message || "Failed to load bookings."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (password) {
      adminLogin(password)
        .then(() => {
          setAuthed(true);
          load(password);
        })
        .catch(() => {
          sessionStorage.removeItem(STORAGE_KEY);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError(null);
    try {
      await adminLogin(password);
      sessionStorage.setItem(STORAGE_KEY, password);
      setAuthed(true);
      load(password);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoggingIn(false);
    }
  };

  const setStatus = async (id: number, status: Booking["status"]) => {
    setBusyId(id);
    try {
      await updateBookingStatus(password, id, status);
      setBookings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, status } : b)),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update booking.");
    } finally {
      setBusyId(null);
    }
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-base-200 text-base-content flex items-center justify-center px-4">
        <div className="card bg-base-100 shadow-xl border border-base-300 w-full max-w-sm">
          <div className="card-body">
            <h1 className="text-xl font-bold mb-2">Admin login</h1>
            <form onSubmit={handleLogin} className="space-y-3">
              <input
                type="password"
                autoFocus
                className="input input-bordered w-full"
                placeholder="Admin password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {loginError && <div className="alert alert-error">{loginError}</div>}
              <button className="btn btn-primary w-full" type="submit" disabled={loggingIn}>
                {loggingIn ? <span className="loading loading-spinner loading-sm" /> : "Log in"}
              </button>
            </form>
            <Link className="link text-sm mt-2" to="/">
              Back to site
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200 text-base-content">
      <div className="navbar max-w-6xl mx-auto px-4">
        <div className="flex-1">
          <Link className="btn btn-ghost text-base sm:text-xl font-bold px-2 whitespace-nowrap" to="/">
            Lorena <span className="font-normal">Interpreting — Admin</span>
          </Link>
        </div>
        <div className="flex-none">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => load(password)}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 pb-16">
        {error && <div className="alert alert-error mb-4">{error}</div>}
        {loading && (
          <div className="flex justify-center py-8">
            <span className="loading loading-spinner loading-lg" />
          </div>
        )}

        {!loading && bookings.length === 0 && !error && (
          <div className="alert alert-info">No bookings yet.</div>
        )}

        <div className="overflow-x-auto">
          <table className="table bg-base-100 rounded-xl">
            <thead>
              <tr>
                <th>Reference</th>
                <th>When</th>
                <th>Service</th>
                <th>Client</th>
                <th>Languages</th>
                <th>Price</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td className="font-mono text-xs">{b.reference}</td>
                  <td>
                    {b.date} {b.start_time}
                  </td>
                  <td>{b.service_name}</td>
                  <td>
                    <div>{b.client_name}</div>
                    <div className="text-xs text-base-content/60">
                      {b.client_email}
                      {b.client_phone ? ` • ${b.client_phone}` : ""}
                    </div>
                    {b.notes && (
                      <div className="text-xs text-base-content/50 italic">
                        {b.notes}
                      </div>
                    )}
                  </td>
                  <td>{b.language_pair}</td>
                  <td>
                    {b.price_cents !== undefined ? formatPrice(b.price_cents) : "—"}
                  </td>
                  <td>
                    <span
                      className={`badge badge-outline ${
                        b.status === "confirmed"
                          ? "badge-success"
                          : b.status === "cancelled"
                            ? "badge-error"
                            : "badge-warning"
                      }`}
                    >
                      {b.status}
                    </span>
                  </td>
                  <td className="space-x-1 whitespace-nowrap">
                    {b.status !== "confirmed" && (
                      <button
                        className="btn btn-xs btn-success"
                        disabled={busyId === b.id}
                        onClick={() => setStatus(b.id, "confirmed")}
                      >
                        Confirm
                      </button>
                    )}
                    {b.status !== "cancelled" && (
                      <button
                        className="btn btn-xs btn-error"
                        disabled={busyId === b.id}
                        onClick={() => setStatus(b.id, "cancelled")}
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
