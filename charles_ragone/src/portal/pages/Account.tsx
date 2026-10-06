import { useState, type FormEvent } from "react";
import PortalLayout from "../components/PortalLayout";
import { ApiError, apiFetch } from "../api";

export default function Account() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (next !== confirm) {
      setError("The new passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch("/auth/password", {
        method: "POST",
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
      setCurrent("");
      setNext("");
      setConfirm("");
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Your current password is wrong.");
      } else if (err instanceof ApiError && err.status === 400) {
        setError("New password must be at least 8 characters.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PortalLayout>
      <h1 className="mb-4 text-xl font-semibold">Account</h1>
      <form onSubmit={handleSubmit} className="card w-full max-w-sm bg-base-200 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-base">Change password</h2>
          <label className="form-control">
            <span className="label-text">Current password</span>
            <input
              type="password"
              className="input input-bordered w-full"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <label className="form-control">
            <span className="label-text">New password</span>
            <input
              type="password"
              className="input input-bordered w-full"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <label className="form-control">
            <span className="label-text">Confirm new password</span>
            <input
              type="password"
              className="input input-bordered w-full"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          {error && (
            <div className="alert alert-error text-sm">
              <span>{error}</span>
            </div>
          )}
          {done && (
            <div className="alert alert-success text-sm">
              <span>Password changed. Other devices have been signed out.</span>
            </div>
          )}
          <button type="submit" className="btn btn-primary mt-2" disabled={submitting}>
            {submitting ? <span className="loading loading-spinner" /> : "Change password"}
          </button>
        </div>
      </form>
    </PortalLayout>
  );
}
