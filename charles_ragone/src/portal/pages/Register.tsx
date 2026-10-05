import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ApiError } from "../api";
import { useAuth } from "../useAuth";

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
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
      await register(username, email, password);
      navigate("/");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("That username or email is already taken.");
      } else if (err instanceof ApiError && err.status === 400) {
        setError("Please check your username, email, and password (min 8 characters).");
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
            <h2 className="card-title">Create an account</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <label className="form-control">
                <span className="label-text">Username</span>
                <input
                  className="input input-bordered w-full"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </label>
              <label className="form-control">
                <span className="label-text">Email</span>
                <input
                  type="email"
                  className="input input-bordered w-full"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
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
              <button type="submit" className="btn btn-primary mt-2" disabled={submitting}>
                {submitting ? <span className="loading loading-spinner" /> : "Register"}
              </button>
            </form>
            <p className="mt-2 text-sm">
              Already have an account? <Link to="/login" className="link link-primary">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
