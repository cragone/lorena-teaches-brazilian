import { useEffect, useState } from "react";
import PortalLayout from "../components/PortalLayout";
import PayRequestModal from "../components/PayRequestModal";
import RotationWidget from "../components/RotationWidget";
import { fetchMyPayments, formatCents } from "../payments-api";
import { useAuth } from "../useAuth";
import { useViewMode } from "../useViewMode";
import { PAYMENT_CATEGORIES, type PaymentRequest, type RecurringPayment } from "../types";

function categoryLabel(category: string) {
  return PAYMENT_CATEGORIES.find((c) => c.value === category)?.label ?? category;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { viewMode } = useViewMode();
  const effectiveAdmin = user?.role === "admin" && viewMode === "admin";

  const [requests, setRequests] = useState<PaymentRequest[] | null>(null);
  const [recurring, setRecurring] = useState<RecurringPayment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState<PaymentRequest | null>(null);

  async function load() {
    try {
      const payments = await fetchMyPayments();
      setRequests(payments.payment_requests);
      setRecurring(payments.recurring_payments);
    } catch {
      setError("Failed to load your billing info.");
    }
  }

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, []);

  const pending = requests?.filter((r) => r.status === "pending" || r.status === "failed") ?? [];
  const pendingTotalCents = pending.reduce((sum, r) => sum + r.amount_cents, 0);
  const history = requests?.filter((r) => r.status === "succeeded" || r.status === "processing") ?? [];
  const nextRecurring = recurring
    ?.filter((r) => r.active)
    .sort((a, b) => new Date(a.next_run_at).getTime() - new Date(b.next_run_at).getTime())[0];

  return (
    <PortalLayout>
      <h1 className="mb-1 text-xl font-semibold">Welcome, {user?.username}</h1>
      <p className="mb-6 text-sm opacity-70">{user?.email}</p>

      <div className="stats stats-vertical mb-6 w-full shadow sm:stats-horizontal">
        <div className="stat">
          <div className="stat-title">Amount due</div>
          <div className="stat-value text-primary">
            {requests ? formatCents(pendingTotalCents) : <span className="loading loading-spinner loading-sm" />}
          </div>
          <div className="stat-desc">
            {requests ? `${pending.length} pending request${pending.length === 1 ? "" : "s"}` : "Loading..."}
          </div>
        </div>
        <div className="stat">
          <div className="stat-title">Next autopay</div>
          <div className="stat-value text-lg">
            {!recurring ? (
              <span className="loading loading-spinner loading-sm" />
            ) : nextRecurring ? (
              new Date(nextRecurring.next_run_at).toLocaleDateString()
            ) : (
              "None set up"
            )}
          </div>
          <div className="stat-desc">{nextRecurring ? formatCents(nextRecurring.amount_cents) : " "}</div>
        </div>
        <div className="stat">
          <div className="stat-title">Account</div>
          <div className="stat-value text-lg capitalize">{user?.role}</div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error mb-4 text-sm">
          <span>{error}</span>
        </div>
      )}

      <h2 className="mb-2 text-lg font-semibold">Pending</h2>
      {!requests ? (
        <span className="loading loading-spinner" />
      ) : pending.length === 0 ? (
        <p className="mb-6 text-sm opacity-70">Nothing pending.</p>
      ) : (
        <div className="mb-6 overflow-x-auto">
          <table className="table table-stack">
            <thead>
              <tr>
                <th>Category</th>
                <th>Amount</th>
                <th>Description</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pending.map((r) => (
                <tr key={r.id}>
                  <td data-label="Category">{categoryLabel(r.category)}</td>
                  <td data-label="Amount">{formatCents(r.amount_cents, r.currency)}</td>
                  <td data-label="Description">{r.unit_name ? `${r.unit_name}: ` : ""}{r.description}{r.paid_by ? ` (paid by ${r.paid_by})` : ""}</td>
                  <td data-label="Status">
                    <span className={`badge ${r.status === "failed" ? "badge-error" : "badge-warning"}`}>
                      {r.status}
                    </span>
                  </td>
                  <td data-label="">
                    <button className="btn btn-xs btn-primary" onClick={() => setPaying(r)}>
                      Pay now
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {effectiveAdmin && (
        <>
        <h2 className="mb-2 text-lg font-semibold">My recurring payments</h2>
        {!recurring ? (
          <span className="loading loading-spinner" />
        ) : recurring.length === 0 ? (
          <p className="mb-6 text-sm opacity-70">None set up yet.</p>
        ) : (
          <div className="mb-6 overflow-x-auto">
            <table className="table table-stack">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Day of month</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recurring.map((r) => (
                  <tr key={r.id}>
                    <td data-label="Category">{categoryLabel(r.category)}</td>
                    <td data-label="Amount">{formatCents(r.amount_cents, r.currency)}</td>
                    <td data-label="Day of month">{r.day_of_month}</td>
                    <td data-label="Status">
                      <span className={`badge ${r.active ? "badge-success" : "badge-ghost"}`}>
                        {r.active ? "active" : "paused"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </>
      )}

      <h2 className="mb-2 text-lg font-semibold">History</h2>
      {!requests ? (
        <span className="loading loading-spinner" />
      ) : history.length === 0 ? (
        <p className="text-sm opacity-70">No payments yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-stack">
            <thead>
              <tr>
                <th>Category</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {history.map((r) => (
                <tr key={r.id}>
                  <td data-label="Category">{categoryLabel(r.category)}</td>
                  <td data-label="Amount">{formatCents(r.amount_cents, r.currency)}</td>
                  <td data-label="Status">
                    <span className="badge badge-success">{r.status}</span>
                  </td>
                  <td data-label="Date">{new Date(r.paid_at ?? r.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}


      {effectiveAdmin && <RotationWidget />}

      {paying && <PayRequestModal request={paying} onClose={() => setPaying(null)} onPaid={load} />}
    </PortalLayout>
  );
}
