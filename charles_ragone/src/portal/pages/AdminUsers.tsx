import { useEffect, useState } from "react";
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

  return (
    <PortalLayout>
      <h1 className="mb-4 text-xl font-semibold">Users</h1>
      {error && (
        <div className="alert alert-error mb-4 text-sm">
          <span>{error}</span>
        </div>
      )}
      {!users ? (
        <span className="loading loading-spinner" />
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
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
        <td>{user.username}</td>
        <td>{user.email}</td>
        <td>
          <button
            className={`btn btn-xs ${user.role === "admin" ? "btn-outline" : "btn-primary"}`}
            onClick={onToggleRole}
          >
            {user.role === "admin" ? "Demote to user" : "Promote to admin"}
          </button>
        </td>
        <td>
          <button
            className={`btn btn-xs ${user.disabled_at ? "btn-error" : "btn-success"}`}
            onClick={onToggleDisabled}
          >
            {user.disabled_at ? "disabled" : "active"}
          </button>
        </td>
        <td>
          <button className="btn btn-xs btn-ghost" onClick={() => setResetting((v) => !v)}>
            Reset password
          </button>
        </td>
      </tr>
      {resetting && (
        <tr>
          <td colSpan={5}>
            <div className="flex items-center gap-2">
              <input
                type="password"
                className="input input-bordered input-sm"
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
