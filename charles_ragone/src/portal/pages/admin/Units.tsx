import { useEffect, useState, type FormEvent } from "react";
import PortalLayout from "../../components/PortalLayout";
import { apiFetch } from "../../api";
import type { Unit, User } from "../../types";

export default function Units() {
  const [units, setUnits] = useState<Unit[] | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");

  async function load() {
    try {
      const [unitsData, usersData] = await Promise.all([
        apiFetch<{ units: Unit[] }>("/admin/units"),
        apiFetch<{ users: User[] }>("/admin/users"),
      ]);
      setUnits(unitsData.units);
      setUsers(usersData.users);
    } catch {
      setError("Failed to load units.");
    }
  }

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, []);

  async function run(action: () => Promise<unknown>, message: string) {
    setError(null);
    try {
      await action();
      await load();
    } catch {
      setError(message);
    }
  }

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    run(async () => {
      await apiFetch("/admin/units", { method: "POST", body: JSON.stringify({ name }) });
      setName("");
    }, "Couldn't create that unit (name already used?).");
  }

  return (
    <PortalLayout>
      <h1 className="mb-4 text-xl font-semibold">Units</h1>
      {error && (
        <div className="alert alert-error mb-4 text-sm">
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleCreate} className="card mb-6 w-full max-w-2xl bg-base-200 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-base">New apartment / house</h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              className="input input-bordered input-sm w-full sm:w-64"
              placeholder="e.g. 12 Yates St, Apt 2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <button className="btn btn-primary btn-sm w-full sm:w-auto">Add unit</button>
          </div>
        </div>
      </form>

      {!units ? (
        <span className="loading loading-spinner" />
      ) : (
        <div className="flex flex-col gap-4">
          {units.map((unit) => (
            <UnitCard
              key={unit.id}
              unit={unit}
              users={users}
              onAdd={(userId) =>
                run(
                  () => apiFetch(`/admin/units/${unit.id}/members`, { method: "POST", body: JSON.stringify({ user_id: userId }) }),
                  "Couldn't add that person (already in this unit?).",
                )
              }
              onRemove={(userId) =>
                run(() => apiFetch(`/admin/units/${unit.id}/members/${userId}`, { method: "DELETE" }), "Couldn't remove that person.")
              }
              onDelete={() => {
                if (!window.confirm(`Delete ${unit.name}?`)) return;
                run(() => apiFetch(`/admin/units/${unit.id}`, { method: "DELETE" }), "Can't delete a unit that has charges.");
              }}
            />
          ))}
          {units.length === 0 && <p className="text-sm opacity-70">No units yet.</p>}
        </div>
      )}
    </PortalLayout>
  );
}

function UnitCard({
  unit,
  users,
  onAdd,
  onRemove,
  onDelete,
}: {
  unit: Unit;
  users: User[];
  onAdd: (userId: number) => void;
  onRemove: (userId: number) => void;
  onDelete: () => void;
}) {
  const [userId, setUserId] = useState("");
  const available = users.filter((u) => !unit.members.some((m) => m.user_id === u.id));

  return (
    <div className="card w-full max-w-2xl bg-base-200 shadow">
      <div className="card-body">
        <div className="flex items-center justify-between">
          <h2 className="card-title text-base">{unit.name}</h2>
          <button className="btn btn-ghost btn-xs text-error" onClick={onDelete}>
            Delete
          </button>
        </div>
        <ul className="flex flex-col gap-1 text-sm">
          {unit.members.map((m) => (
            <li key={m.user_id} className="flex items-center justify-between">
              <span>
                {m.username} <span className="opacity-60">{m.email}</span>
              </span>
              <button className="btn btn-ghost btn-xs" onClick={() => onRemove(m.user_id)}>
                Remove
              </button>
            </li>
          ))}
          {unit.members.length === 0 && <li className="opacity-70">No members yet.</li>}
        </ul>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select className="select select-bordered select-sm w-full sm:w-auto" value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">Add person…</option>
            {available.map((u) => (
              <option key={u.id} value={u.id}>
                {u.username}
              </option>
            ))}
          </select>
          <button
            className="btn btn-sm btn-primary"
            disabled={!userId}
            onClick={() => {
              onAdd(Number(userId));
              setUserId("");
            }}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
