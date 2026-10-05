import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PortalLayout from "../components/PortalLayout";
import RotationWidget from "../components/RotationWidget";
import { fetchMyPayments, formatCents } from "../payments-api";
import { useAuth } from "../useAuth";
import { useViewMode } from "../useViewMode";
import type { PaymentRequest, RecurringPayment } from "../types";

export default function Dashboard() {
  const { user } = useAuth();
  const { viewMode } = useViewMode();
  const effectiveAdmin = user?.role === "admin" && viewMode === "admin";

  const [requests, setRequests] = useState<PaymentRequest[] | null>(null);
  const [recurring, setRecurring] = useState<RecurringPayment[] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const payments = await fetchMyPayments();
        setRequests(payments.payment_requests);
        setRecurring(payments.recurring_payments);
      } catch {
        // Dashboard stats are a convenience; Billing page surfaces real errors.
      }
    })();
  }, []);

  const pending = requests?.filter((r) => r.status === "pending" || r.status === "failed") ?? [];
  const pendingTotalCents = pending.reduce((sum, r) => sum + r.amount_cents, 0);
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
          <div className="stat-desc">
            <Link to="/billing" className="link link-primary">
              Go to Billing &rarr;
            </Link>
          </div>
        </div>
      </div>

      {effectiveAdmin && <RotationWidget />}
    </PortalLayout>
  );
}
