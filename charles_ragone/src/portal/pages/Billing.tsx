import { useEffect, useState } from "react";
import PortalLayout from "../components/PortalLayout";
import SavePaymentMethodForm from "../components/SavePaymentMethodForm";
import PayRequestModal from "../components/PayRequestModal";
import { fetchMyPaymentMethod, fetchMyPayments, formatCents } from "../payments-api";
import { PAYMENT_CATEGORIES, type PaymentRequest, type RecurringPayment } from "../types";

function categoryLabel(category: string) {
  return PAYMENT_CATEGORIES.find((c) => c.value === category)?.label ?? category;
}

export default function Billing() {
  const [hasPaymentMethod, setHasPaymentMethod] = useState<boolean | null>(null);
  const [recurring, setRecurring] = useState<RecurringPayment[] | null>(null);
  const [requests, setRequests] = useState<PaymentRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addingCard, setAddingCard] = useState(false);
  const [paying, setPaying] = useState<PaymentRequest | null>(null);

  async function load() {
    try {
      const [method, payments] = await Promise.all([fetchMyPaymentMethod(), fetchMyPayments()]);
      setHasPaymentMethod(method.has_payment_method);
      setRecurring(payments.recurring_payments);
      setRequests(payments.payment_requests);
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
  const history = requests?.filter((r) => r.status === "succeeded" || r.status === "processing") ?? [];

  return (
    <PortalLayout>
      <h1 className="mb-4 text-xl font-semibold">Billing</h1>
      {error && (
        <div className="alert alert-error mb-4 text-sm">
          <span>{error}</span>
        </div>
      )}

      <div className="card mb-6 max-w-md bg-base-200 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-base">Payment method</h2>
          {hasPaymentMethod === null ? (
            <span className="loading loading-spinner" />
          ) : addingCard ? (
            <SavePaymentMethodForm
              onSaved={() => {
                setAddingCard(false);
                load();
              }}
            />
          ) : (
            <div className="flex items-center gap-3">
              <span className={`badge ${hasPaymentMethod ? "badge-success" : "badge-warning"}`}>
                {hasPaymentMethod ? "Card on file" : "No card on file"}
              </span>
              <button className="btn btn-xs" onClick={() => setAddingCard(true)}>
                {hasPaymentMethod ? "Update card" : "Add card"}
              </button>
            </div>
          )}
        </div>
      </div>

      <h2 className="mb-2 text-lg font-semibold">Pending</h2>
      {!requests ? (
        <span className="loading loading-spinner" />
      ) : pending.length === 0 ? (
        <p className="mb-6 text-sm opacity-70">Nothing pending.</p>
      ) : (
        <div className="mb-6 overflow-x-auto">
          <table className="table">
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
                  <td>{categoryLabel(r.category)}</td>
                  <td>{formatCents(r.amount_cents, r.currency)}</td>
                  <td>{r.description}</td>
                  <td>
                    <span className={`badge ${r.status === "failed" ? "badge-error" : "badge-warning"}`}>
                      {r.status}
                    </span>
                  </td>
                  <td>
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

      <h2 className="mb-2 text-lg font-semibold">My recurring payments</h2>
      {!recurring ? (
        <span className="loading loading-spinner" />
      ) : recurring.length === 0 ? (
        <p className="mb-6 text-sm opacity-70">None set up yet.</p>
      ) : (
        <div className="mb-6 overflow-x-auto">
          <table className="table">
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
                  <td>{categoryLabel(r.category)}</td>
                  <td>{formatCents(r.amount_cents, r.currency)}</td>
                  <td>{r.day_of_month}</td>
                  <td>
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

      <h2 className="mb-2 text-lg font-semibold">History</h2>
      {!requests ? (
        <span className="loading loading-spinner" />
      ) : history.length === 0 ? (
        <p className="text-sm opacity-70">No payments yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
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
                  <td>{categoryLabel(r.category)}</td>
                  <td>{formatCents(r.amount_cents, r.currency)}</td>
                  <td>
                    <span className="badge badge-success">{r.status}</span>
                  </td>
                  <td>{new Date(r.paid_at ?? r.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {paying && <PayRequestModal request={paying} onClose={() => setPaying(null)} onPaid={load} />}
    </PortalLayout>
  );
}
