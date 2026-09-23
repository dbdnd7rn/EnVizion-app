import { supabase } from "./supabase";

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

function mapPresence(row: any): CareWorkspacePresence {
  return {
    careRecipientId: row.care_recipient_id,
    userId: row.user_id,
    mode: row.mode as CarePresenceMode,
    screenKey: row.screen_key,
    sessionId: row.session_id ?? null,
    connectedAt: row.connected_at,
    lastSeenAt: row.last_seen_at,
  };
}

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

export async function loadCareWorkspacePresence(careRecipientId: string) {
  const { data, error } = await supabase
    .from("care_workspace_presence")
    .select(
      "care_recipient_id, user_id, mode, screen_key, session_id, connected_at, last_seen_at",
    )
    .eq("care_recipient_id", careRecipientId)
    .order("last_seen_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapPresence);
}

export async function touchCareWorkspacePresence(input: {
  careRecipientId: string;
  userId: string;
  mode: CarePresenceMode;
  screenKey: string;
  sessionId?: string | null;
}) {
  const { error } = await supabase.from("care_workspace_presence").upsert(
    {
      care_recipient_id: input.careRecipientId,
      user_id: input.userId,
      mode: input.mode,
      screen_key: input.screenKey,
      session_id: input.sessionId ?? null,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "care_recipient_id,user_id" },
  );

  if (error) throw error;
}

export async function clearCareWorkspacePresence(
  careRecipientId: string,
  userId: string,
) {
  const { error } = await supabase
    .from("care_workspace_presence")
    .delete()
    .eq("care_recipient_id", careRecipientId)
    .eq("user_id", userId);

  if (error) throw error;
}
