import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ApiError } from "../api";
import { useAuth } from "../useAuth";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(usernameOrEmail, password);
      navigate("/");
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError("This account has been disabled.");
      } else if (err instanceof ApiError && err.status === 401) {
        setError("Invalid username/email or password.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-base-200 p-4 sm:p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-9 w-9 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 11.5 12 4l9 7.5" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.5 10v9a1 1 0 0 0 1 1H10v-5a2 2 0 1 1 4 0v5h3.5a1 1 0 0 0 1-1v-9" />
          </svg>
          <h1 className="text-2xl font-semibold text-primary">Yates</h1>
          <p className="text-sm opacity-70">Pay rent, wifi, and utilities in one place.</p>
        </div>

        <div className="card w-full bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Sign in</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <label className="form-control">
                <span className="label-text">Username or email</span>
                <input
                  className="input input-bordered w-full"
                  value={usernameOrEmail}
                  onChange={(e) => setUsernameOrEmail(e.target.value)}
                  autoComplete="username"
                  required
                />
              </label>
              <label className="form-control">
                <span className="label-text">Password</span>
                <input
                  type="password"
                  className="input input-bordered w-full"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>
              {error && (
                <div className="alert alert-error text-sm">
                  <span>{error}</span>
                </div>
              )}
              <button type="submit" className="btn btn-primary mt-2" disabled={submitting}>
                {submitting ? <span className="loading loading-spinner" /> : "Sign in"}
              </button>
            </form>
            <p className="mt-2 text-sm opacity-70">Accounts are created by your property manager.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
