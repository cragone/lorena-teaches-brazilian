import { apiFetch } from "./api";
import type { RotationAssignment, RotationMember, RotationSettings } from "./types";

export async function fetchRotationMembers() {
  return apiFetch<{ members: RotationMember[] }>("/admin/rotation/members");
}

export async function addRotationMember(userId: number) {
  return apiFetch<{ member: RotationMember }>("/admin/rotation/members", {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
}

export async function setRotationMemberActive(id: number, active: boolean) {
  return apiFetch<{ member: RotationMember }>(`/admin/rotation/members/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ active }),
  });
}

export async function reorderRotationMembers(memberIds: number[]) {
  return apiFetch<{ members: RotationMember[] }>("/admin/rotation/members/order", {
    method: "PUT",
    body: JSON.stringify({ member_ids: memberIds }),
  });
}

export async function fetchRotationSettings() {
  return apiFetch<{ settings: RotationSettings }>("/admin/rotation/settings");
}

export async function updateRotationSettings(amountCents: number) {
  return apiFetch<{ settings: RotationSettings }>("/admin/rotation/settings", {
    method: "PATCH",
    body: JSON.stringify({ amount_cents: amountCents }),
  });
}

export async function fetchRotationAssignments() {
  return apiFetch<{ assignments: RotationAssignment[]; warning?: string }>("/admin/rotation/assignments");
}

export async function recordRotationWork(id: number, notes: string) {
  return apiFetch<{ assignment: RotationAssignment }>(`/admin/rotation/assignments/${id}/waive`, {
    method: "POST",
    body: JSON.stringify({ notes }),
  });
}

export async function chargeRotationAssignment(id: number) {
  return apiFetch<{ assignment: RotationAssignment }>(`/admin/rotation/assignments/${id}/charge`, {
    method: "POST",
  });
}

export async function resetRotationAssignment(id: number) {
  return apiFetch<{ assignment: RotationAssignment }>(`/admin/rotation/assignments/${id}/reset`, {
    method: "POST",
  });
}

export async function reassignRotationAssignment(id: number, rotationMemberId: number) {
  return apiFetch<{ assignment: RotationAssignment }>(`/admin/rotation/assignments/${id}/assignee`, {
    method: "PATCH",
    body: JSON.stringify({ rotation_member_id: rotationMemberId }),
  });
}

export async function fetchRotationSchedule() {
  return apiFetch<{ members: RotationMember[]; assignments: RotationAssignment[] }>("/rotation/schedule");
}
