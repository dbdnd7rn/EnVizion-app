import { supabase } from "./supabase";
import {
  type CarePresenceMode,
  type CareWorkspacePresence,
} from "./carePresenceHelpers";

export {
  presenceIsLive,
  presenceModeLabel,
  presenceScreenLabel,
} from "./carePresenceHelpers";
export type {
  CarePresenceMode,
  CareWorkspacePresence,
} from "./carePresenceHelpers";

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
