/** Strongly scope UI results to both the signed-in account and care profile. */
export function emergencyScope(userId: string | null | undefined, careRecipientId: string | null | undefined): string | null {
  return userId && careRecipientId ? userId + ":" + careRecipientId : null;
}

export function isCurrentEmergencyRequest(
  requestedScope: string | null,
  activeScope: string | null,
  requestedSequence: number,
  activeSequence: number,
): boolean {
  return requestedScope !== null && requestedScope === activeScope
    && requestedSequence === activeSequence;
}

/** A denied session or revoked permission must never fall back to old cached PHI. */
export function emergencyAccessWasDenied(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const detail = error as { status?: unknown; code?: unknown };
  return detail.status === 401 || detail.status === 403 ||
    detail.code === "42501" || detail.code === "PGRST301";
}

export function emergencySnapshotStaleness(cachedAt: string, now = new Date()): string | null {
  const age = now.getTime() - Date.parse(cachedAt);
  if (!Number.isFinite(age) || age < 0) return "The age of this emergency snapshot could not be verified. Confirm all details with the care team.";
  if (age >= 7 * 86400000) return "This offline emergency snapshot is over 7 days old. Confirm medications, allergies, directives, and contacts before relying on it.";
  return null;
}
