import { useEffect, useState, type FormEvent } from "react";
import PortalLayout from "../../components/PortalLayout";
import { apiFetch } from "../../api";
import { createPaymentRequest, deletePaymentRequest, fetchPaymentRequests, formatCents } from "../../payments-api";
import { PAYMENT_CATEGORIES, type PaymentCategory, type PaymentRequest, type User } from "../../types";

export default function PaymentRequests() {
  const [rows, setRows] = useState<PaymentRequest[] | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [userId, setUserId] = useState("");
  const [category, setCategory] = useState<PaymentCategory>("rent");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  async function load() {
    try {
      const [requests, usersData] = await Promise.all([fetchPaymentRequests(), apiFetch<{ users: User[] }>("/admin/users")]);
      setRows(requests.payment_requests);
      setUsers(usersData.users);
    } catch {
      setError("Failed to load payment requests.");
    }
  }

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, []);

  async function handleDelete(id: number) {
    if (!window.confirm("Permanently delete this payment entry? This cannot be undone.")) {
      return;
    }
    setError(null);
    try {
      await deletePaymentRequest(id);
      await load();
    } catch {
      setError("Couldn't delete that payment.");
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const cents = Math.round(parseFloat(amount) * 100);
    if (!userId || Number.isNaN(cents) || cents <= 0) {
      setError("Pick a user and enter a valid amount.");
      return;
    }
    try {
      await createPaymentRequest({
        user_id: Number(userId),
        category,
        amount_cents: cents,
        description,
      });
      setAmount("");
      setDescription("");
      await load();
    } catch {
      setError("Couldn't create that request.");
    }
  }

  return (
    <PortalLayout>
      <h1 className="mb-4 text-xl font-semibold">Payment requests</h1>
      {error && (
        <div className="alert alert-error mb-4 text-sm">
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleCreate} className="card mb-6 w-full max-w-2xl bg-base-200 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-base">New request</h2>
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <select className="select select-bordered select-sm w-full sm:w-auto" value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Select user</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username}
                </option>
              ))}
            </select>
            <select
              className="select select-bordered select-sm w-full sm:w-auto"
              value={category}
              onChange={(e) => setCategory(e.target.value as PaymentCategory)}
            >
              {PAYMENT_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Amount"
              className="input input-bordered input-sm w-full sm:w-28"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <input
              type="text"
              placeholder="Description"
              className="input input-bordered input-sm w-full sm:w-auto"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <button className="btn btn-primary btn-sm w-full sm:w-auto">Send request</button>
          </div>
        </div>
      </form>

      {!rows ? (
        <span className="loading loading-spinner" />
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-stack">
            <thead>
              <tr>
                <th>User</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Description</th>
                <th>Source</th>
                <th>Status</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td data-label="User">{r.username}</td>
                  <td className="capitalize" data-label="Category">{r.category.replace("_", " ")}</td>
                  <td data-label="Amount">{formatCents(r.amount_cents, r.currency)}</td>
                  <td data-label="Description">{r.description}</td>
                  <td className="capitalize" data-label="Source">{r.source}</td>
                  <td data-label="Status">
                    <span
                      className={`badge ${
                        r.status === "succeeded" ? "badge-success" : r.status === "failed" ? "badge-error" : "badge-warning"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td data-label="Date">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td>
                    <button className="btn btn-ghost btn-xs text-error" onClick={() => handleDelete(r.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PortalLayout>
  );
}
