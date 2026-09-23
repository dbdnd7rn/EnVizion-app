export type CarePresenceMode =
  | "workspace"
  | "on_shift"
  | "handoff_review"
  | "coordination";

export type CareWorkspacePresence = {
  careRecipientId: string;
  userId: string;
  mode: CarePresenceMode;
  screenKey: string;
  sessionId: string | null;
  connectedAt: string;
  lastSeenAt: string;
};

export function presenceIsLive(
  presence: CareWorkspacePresence,
  now = new Date(),
  maxAgeMs = 150_000,
) {
  const seen = new Date(presence.lastSeenAt).getTime();
  return Number.isFinite(seen) && now.getTime() - seen <= maxAgeMs;
}

export function presenceModeLabel(mode: CarePresenceMode) {
  if (mode === "on_shift") return "On shift";
  if (mode === "handoff_review") return "Reviewing handoff";
  if (mode === "coordination") return "Coordinating care";
  return "In EnVizion";
}

export function presenceScreenLabel(screenKey: string) {
  const labels: Record<string, string> = {
    care_workspace: "Care workspace",
    on_shift: "On-shift caregiver",
    shift_board: "Shift board",
    continuity: "Continuity timeline",
    coordination_inbox: "Coordination inbox",
    schedule: "Caregiver schedule",
  };
  return labels[screenKey] ?? "Care workspace";
}
