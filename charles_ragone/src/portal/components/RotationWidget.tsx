import { useEffect, useState } from "react";
import { fetchRotationSchedule } from "../rotation-api";
import { useAuth } from "../useAuth";
import type { RotationAssignment, RotationMember } from "../types";

function monthLabel(month: string) {
  const [year, m] = month.split("-").map(Number);
  return new Date(year, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export default function RotationWidget() {
  const { user } = useAuth();
  const [members, setMembers] = useState<RotationMember[] | null>(null);
  const [current, setCurrent] = useState<RotationAssignment | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchRotationSchedule();
        setMembers(data.members);
        setCurrent(data.assignments[0] ?? null);
      } catch {
        setMembers(null);
      }
    })();
  }, []);

  if (!members || !user || !members.some((m) => m.user_id === user.id)) {
    return null;
  }

  const isMe = current?.user_id === user.id;

  return (
    <div className="card mb-6 max-w-md bg-base-200 shadow-xl">
      <div className="card-body">
        <h2 className="card-title text-base">Property manager</h2>
        {current ? (
          <>
            <p className="text-sm">
              {monthLabel(current.month)}: <span className="font-semibold">{current.username}</span>
              {isMe && <span className="badge badge-primary ml-2">You're up</span>}
            </p>
            {current.resolution === "pending" && isMe && (
              <p className="text-xs opacity-70">Do the work this month, or the admin will charge the fee.</p>
            )}
          </>
        ) : (
          <p className="text-sm opacity-70">No assignment yet.</p>
        )}
      </div>
    </div>
  );
}
