import { useEffect, useState, type FormEvent } from "react";
import PortalLayout from "../components/PortalLayout";
import { apiFetch } from "../api";
import type { User } from "../types";

export default function AdminUsers() {
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const data = await apiFetch<{ users: User[] }>("/admin/users");
      setUsers(data.users);
    } catch {
      setError("Failed to load users.");
    }
  }

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, []);

  async function toggleRole(user: User) {
    const role = user.role === "admin" ? "user" : "admin";
    try {
      await apiFetch(`/admin/users/${user.id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      await load();
    } catch {
      setError("Couldn't change that user's role (maybe they're the last admin?).");
    }
  }

  async function toggleDisabled(user: User) {
    try {
      await apiFetch(`/admin/users/${user.id}/disabled`, {
        method: "PATCH",
        body: JSON.stringify({ disabled: !user.disabled_at }),
      });
      await load();
    } catch {
      setError("Couldn't update that user's status.");
    }
  }

  const [form, setForm] = useState({ username: "", email: "", password: "", role: "user" });

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch("/admin/users", { method: "POST", body: JSON.stringify(form) });
      setForm({ username: "", email: "", password: "", role: "user" });
      await load();
    } catch {
      setError("Couldn't create that account (username/email taken, or password under 8 characters).");
    }
  }

  return (
    <PortalLayout>
      <h1 className="mb-4 text-xl font-semibold">Users</h1>
      <form onSubmit={handleCreate} className="card mb-6 w-full max-w-2xl bg-base-200 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-base">New account</h2>
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <input className="input input-bordered input-sm w-full sm:w-36" placeholder="Username" required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            <input type="email" className="input input-bordered input-sm w-full sm:w-52" placeholder="Email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input type="password" minLength={8} className="input input-bordered input-sm w-full sm:w-40" placeholder="Temporary password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <select className="select select-bordered select-sm w-full sm:w-auto" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="user">Tenant</option>
              <option value="admin">Admin (property manager)</option>
            </select>
            <button className="btn btn-primary btn-sm w-full sm:w-auto">Create</button>
          </div>
        </div>
      </form>
      {error && (
        <div className="alert alert-error mb-4 text-sm">
          <span>{error}</span>
        </div>
      )}
      {!users ? (
        <span className="loading loading-spinner" />
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-stack">
            <thead>
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  onToggleRole={() => toggleRole(user)}
                  onToggleDisabled={() => toggleDisabled(user)}
                  onPasswordReset={load}
                  onError={setError}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PortalLayout>
  );
}

function UserRow({
  user,
  onToggleRole,
  onToggleDisabled,
  onPasswordReset,
  onError,
}: {
  user: User;
  onToggleRole: () => void;
  onToggleDisabled: () => void;
  onPasswordReset: () => void;
  onError: (message: string) => void;
}) {
  const [resetting, setResetting] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  async function submitReset() {
    try {
      await apiFetch(`/admin/users/${user.id}/password`, {
        method: "PATCH",
        body: JSON.stringify({ new_password: newPassword }),
      });
      setResetting(false);
      setNewPassword("");
      onPasswordReset();
    } catch {
      onError("Couldn't reset that user's password (min 8 characters).");
    }
  }

  return (
    <>
      <tr>
        <td data-label="Username">{user.username}</td>
        <td data-label="Email">{user.email}</td>
        <td data-label="Role">
          <button
            className={`btn btn-xs ${user.role === "admin" ? "btn-outline" : "btn-primary"}`}
            onClick={onToggleRole}
          >
            {user.role === "admin" ? "Demote to user" : "Promote to admin"}
          </button>
        </td>
        <td data-label="Status">
          <button
            className={`btn btn-xs ${user.disabled_at ? "btn-error" : "btn-success"}`}
            onClick={onToggleDisabled}
          >
            {user.disabled_at ? "disabled" : "active"}
          </button>
        </td>
        <td data-label="">
          <button className="btn btn-xs btn-ghost" onClick={() => setResetting((v) => !v)}>
            Reset password
          </button>
        </td>
      </tr>
      {resetting && (
        <tr>
          <td colSpan={5} className="stack-full">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="password"
                className="input input-bordered input-sm w-full sm:w-auto"
                placeholder="New password"
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <button className="btn btn-sm btn-primary" onClick={submitReset}>
                Save
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
