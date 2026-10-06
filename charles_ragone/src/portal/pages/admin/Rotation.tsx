import { useEffect, useState, type FormEvent } from "react";
import PortalLayout from "../../components/PortalLayout";
import { apiFetch } from "../../api";
import { formatCents } from "../../payments-api";
import {
  addRotationMember,
  chargeRotationAssignment,
  fetchRotationAssignments,
  fetchRotationMembers,
  fetchRotationSettings,
  reassignRotationAssignment,
  recordRotationWork,
  reorderRotationMembers,
  resetRotationAssignment,
  setRotationMemberActive,
  updateRotationSettings,
} from "../../rotation-api";
import type { RotationAssignment, RotationMember, RotationSettings, User } from "../../types";

function monthLabel(month: string) {
  const [year, m] = month.split("-").map(Number);
  return new Date(year, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export default function Rotation() {
  const [members, setMembers] = useState<RotationMember[] | null>(null);
  const [settings, setSettings] = useState<RotationSettings | null>(null);
  const [assignments, setAssignments] = useState<RotationAssignment[] | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [newUserId, setNewUserId] = useState("");
  const [amount, setAmount] = useState("");
  const [notesByAssignment, setNotesByAssignment] = useState<Record<number, string>>({});

  async function load() {
    try {
      const [membersData, settingsData, assignmentsData, usersData] = await Promise.all([
        fetchRotationMembers(),
        fetchRotationSettings(),
        fetchRotationAssignments(),
        apiFetch<{ users: User[] }>("/admin/users"),
      ]);
      setMembers(membersData.members);
      setSettings(settingsData.settings);
      setAmount((settingsData.settings.amount_cents / 100).toString());
      setAssignments(assignmentsData.assignments);
      setWarning(assignmentsData.warning ?? null);
      setUsers(usersData.users);
    } catch {
      setError("Failed to load the rotation.");
    }
  }

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, []);

  const activeMembers = (members ?? []).filter((m) => m.active);
  const availableUsers = users.filter((u) => !activeMembers.some((m) => m.user_id === u.id));

  async function handleAddMember(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!newUserId) {
      setError("Pick a user to add.");
      return;
    }
    try {
      await addRotationMember(Number(newUserId));
      setNewUserId("");
      await load();
    } catch {
      setError("Couldn't add that member.");
    }
  }

  async function handleRemoveMember(member: RotationMember) {
    try {
      await setRotationMemberActive(member.id, false);
      await load();
    } catch {
      setError("Couldn't remove that member.");
    }
  }

  async function handleMove(member: RotationMember, direction: -1 | 1) {
    const ordered = [...activeMembers].sort((a, b) => a.position - b.position);
    const index = ordered.findIndex((m) => m.id === member.id);
    const swapWith = index + direction;
    if (swapWith < 0 || swapWith >= ordered.length) return;
    [ordered[index], ordered[swapWith]] = [ordered[swapWith], ordered[index]];
    try {
      await reorderRotationMembers(ordered.map((m) => m.id));
      await load();
    } catch {
      setError("Couldn't reorder the rotation.");
    }
  }

  async function handleSaveSettings(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const cents = Math.round(parseFloat(amount) * 100);
    if (Number.isNaN(cents) || cents <= 0) {
      setError("Enter a valid charge amount.");
      return;
    }
    try {
      const data = await updateRotationSettings(cents);
      setSettings(data.settings);
    } catch {
      setError("Couldn't update the charge amount.");
    }
  }

  async function handleRecordWork(assignment: RotationAssignment) {
    try {
      await recordRotationWork(assignment.id, notesByAssignment[assignment.id] ?? "");
      await load();
    } catch {
      setError("Couldn't record that work.");
    }
  }

  async function handleCharge(assignment: RotationAssignment) {
    try {
      await chargeRotationAssignment(assignment.id);
      await load();
    } catch {
      setError("Couldn't create that charge.");
    }
  }

  async function handleReassign(assignment: RotationAssignment, memberId: number) {
    setError(null);
    if (assignment.resolution !== "pending" && !window.confirm("This resets the current decision (and cancels any unpaid charge). Continue?")) {
      return;
    }
    try {
      await reassignRotationAssignment(assignment.id, memberId);
      await load();
    } catch {
      setError("Couldn't reassign that month — has it already been paid?");
    }
  }

  async function handleReset(assignment: RotationAssignment) {
    try {
      await resetRotationAssignment(assignment.id);
      await load();
    } catch {
      setError("Couldn't reset that month — has it already been paid?");
    }
  }

  return (
    <PortalLayout>
      <h1 className="mb-4 text-xl font-semibold">Property manager rotation</h1>
      {error && (
        <div className="alert alert-error mb-4 text-sm">
          <span>{error}</span>
        </div>
      )}
      {warning === "no_active_members" && (
        <div className="alert alert-warning mb-4 text-sm">
          <span>No active members — add at least one owner below to resume the rotation.</span>
        </div>
      )}

      <div className="mb-6 flex flex-col gap-4 sm:gap-6 md:flex-row md:flex-wrap">
        <form onSubmit={handleSaveSettings} className="card w-full max-w-sm bg-base-200 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-base">Charge amount</h2>
            <div className="flex items-end gap-3">
              <input
                type="number"
                min="0"
                step="0.01"
                className="input input-bordered input-sm w-full sm:w-28"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <button className="btn btn-primary btn-sm">Save</button>
            </div>
            <p className="text-xs opacity-70">Charged when the month's manager doesn't do the work.</p>
          </div>
        </form>

        <div className="card w-full max-w-md bg-base-200 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-base">Rotation order</h2>
            {!members ? (
              <span className="loading loading-spinner" />
            ) : (
              <ul className="space-y-2">
                {activeMembers
                  .sort((a, b) => a.position - b.position)
                  .map((m, i) => (
                    <li key={m.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span>{m.username}</span>
                      <span className="flex gap-1">
                        <button className="btn btn-xs" disabled={i === 0} onClick={() => handleMove(m, -1)}>
                          ↑
                        </button>
                        <button
                          className="btn btn-xs"
                          disabled={i === activeMembers.length - 1}
                          onClick={() => handleMove(m, 1)}
                        >
                          ↓
                        </button>
                        <button className="btn btn-xs btn-error" onClick={() => handleRemoveMember(m)}>
                          Remove
                        </button>
                      </span>
                    </li>
                  ))}
              </ul>
            )}
            <form onSubmit={handleAddMember} className="mt-3 flex flex-col gap-2 sm:flex-row">
              <select
                className="select select-bordered select-sm w-full sm:w-auto"
                value={newUserId}
                onChange={(e) => setNewUserId(e.target.value)}
              >
                <option value="">Add owner...</option>
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username}
                  </option>
                ))}
              </select>
              <button className="btn btn-sm">Add</button>
            </form>
          </div>
        </div>
      </div>

      <h2 className="mb-2 text-lg font-semibold">Monthly assignments</h2>
      {!assignments ? (
        <span className="loading loading-spinner" />
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-stack">
            <thead>
              <tr>
                <th>Month</th>
                <th>Manager</th>
                <th>Status</th>
                <th>Notes</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id}>
                  <td data-label="Month">{monthLabel(a.month)}</td>
                  <td data-label="Manager">
                    <select
                      className="select select-bordered select-xs w-full sm:w-auto"
                      value={a.rotation_member_id}
                      onChange={(e) => handleReassign(a, Number(e.target.value))}
                      aria-label={`Manager for ${monthLabel(a.month)}`}
                    >
                      {!activeMembers.some((m) => m.id === a.rotation_member_id) && (
                        <option value={a.rotation_member_id}>{a.username} (inactive)</option>
                      )}
                      {activeMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.username}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td data-label="Status">
                    {a.resolution === "pending" && <span className="badge badge-warning">Awaiting decision</span>}
                    {a.resolution === "waived" && <span className="badge badge-success">Work done</span>}
                    {a.resolution === "charged" && (
                      <span
                        className={`badge ${
                          a.payment_status === "succeeded"
                            ? "badge-success"
                            : a.payment_status === "failed"
                              ? "badge-error"
                              : "badge-warning"
                        }`}
                      >
                        Charged {settings && formatCents(settings.amount_cents, settings.currency)} ·{" "}
                        {a.payment_status || "pending"}
                      </span>
                    )}
                  </td>
                  <td data-label="Notes">
                    {a.resolution === "pending" ? (
                      <input
                        type="text"
                        placeholder="Notes (optional)"
                        className="input input-bordered input-sm w-full"
                        value={notesByAssignment[a.id] ?? ""}
                        onChange={(e) => setNotesByAssignment((prev) => ({ ...prev, [a.id]: e.target.value }))}
                      />
                    ) : (
                      a.notes
                    )}
                  </td>
                  <td data-label="">
                    {a.resolution === "pending" ? (
                      <div className="flex flex-wrap justify-end gap-1">
                        <button className="btn btn-xs btn-success" onClick={() => handleRecordWork(a)}>
                          Mark done
                        </button>
                        <button className="btn btn-xs btn-warning" onClick={() => handleCharge(a)}>
                          Charge
                        </button>
                      </div>
                    ) : (
                      <button className="btn btn-xs" onClick={() => handleReset(a)}>
                        Reset
                      </button>
                    )}
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
