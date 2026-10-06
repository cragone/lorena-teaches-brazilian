import { useEffect, useState, type FormEvent } from "react";
import PortalLayout from "../../components/PortalLayout";
import { apiFetch } from "../../api";
import { createRecurringPayment, fetchRecurringPayments, formatCents, setRecurringPaymentActive } from "../../payments-api";
import { PAYMENT_CATEGORIES, type Unit, type PaymentCategory, type RecurringPayment, type User } from "../../types";

export default function RecurringPayments() {
  const [rows, setRows] = useState<RecurringPayment[] | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [userId, setUserId] = useState("");
  const [category, setCategory] = useState<PaymentCategory>("rent");
  const [amount, setAmount] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState("1");

  async function load() {
    try {
      const [payments, usersData, unitsData] = await Promise.all([fetchRecurringPayments(), apiFetch<{ users: User[] }>("/admin/users"), apiFetch<{ units: Unit[] }>("/admin/units")]);
      setRows(payments.recurring_payments);
      setUsers(usersData.users);
      setUnits(unitsData.units);
    } catch {
      setError("Failed to load recurring payments.");
    }
  }

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const cents = Math.round(parseFloat(amount) * 100);
    if (!userId || Number.isNaN(cents) || cents <= 0) {
      setError("Pick a user or unit and enter a valid amount.");
      return;
    }
    try {
      await createRecurringPayment({
        ...(userId.startsWith("unit:") ? { unit_id: Number(userId.slice(5)) } : { user_id: Number(userId) }),
        category,
        amount_cents: cents,
        day_of_month: Number(dayOfMonth),
      });
      setAmount("");
      await load();
    } catch {
      setError("Couldn't create that schedule — does the tenant have a card on file?");
    }
  }

  async function toggleActive(rp: RecurringPayment) {
    try {
      await setRecurringPaymentActive(rp.id, !rp.active);
      await load();
    } catch {
      setError("Couldn't update that schedule.");
    }
  }

  return (
    <PortalLayout>
      <h1 className="mb-4 text-xl font-semibold">Recurring payments</h1>
      {error && (
        <div className="alert alert-error mb-4 text-sm">
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleCreate} className="card mb-6 w-full max-w-2xl bg-base-200 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-base">New schedule</h2>
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <select className="select select-bordered select-sm w-full sm:w-auto" value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Select user or unit</option>
              {units.map((u) => (
                <option key={`unit:${u.id}`} value={`unit:${u.id}`}>
                  {u.name} (unit)
                </option>
              ))}
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
              type="number"
              min="1"
              max="28"
              placeholder="Day"
              className="input input-bordered input-sm w-full sm:w-20"
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(e.target.value)}
            />
            <button className="btn btn-primary btn-sm w-full sm:w-auto">Create</button>
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
                <th>Day of month</th>
                <th>Next run</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((rp) => (
                <tr key={rp.id}>
                  <td data-label="User">{rp.unit_name ? `${rp.unit_name} (unit)` : rp.username}</td>
                  <td className="capitalize" data-label="Category">{rp.category.replace("_", " ")}</td>
                  <td data-label="Amount">{formatCents(rp.amount_cents, rp.currency)}</td>
                  <td data-label="Day of month">{rp.day_of_month}</td>
                  <td data-label="Next run">{new Date(rp.next_run_at).toLocaleDateString()}</td>
                  <td data-label="Status">
                    <span className={`badge ${rp.active ? "badge-success" : "badge-ghost"}`}>
                      {rp.active ? "active" : "paused"}
                    </span>
                  </td>
                  <td data-label="">
                    <button className="btn btn-xs" onClick={() => toggleActive(rp)}>
                      {rp.active ? "Pause" : "Resume"}
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
