import { supabase } from "./supabase";
export { sessionExpiryLabel } from "./sessionSecurityHelpers";

export type SessionSecuritySummary = {
  active: boolean;
  expiresAt: string | null;
  expiresInMinutes: number | null;
};

export async function loadSessionSecuritySummary(): Promise<SessionSecuritySummary> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const session = data.session;
  if (!session) {
    return { active: false, expiresAt: null, expiresInMinutes: null };
  }

  const expiresAt = session.expires_at
    ? new Date(session.expires_at * 1000).toISOString()
    : null;

  return {
    active: true,
    expiresAt,
    expiresInMinutes: session.expires_at
      ? Math.max(0, Math.ceil((session.expires_at * 1000 - Date.now()) / 60_000))
      : null,
  };
}

export async function signOutOtherDevices() {
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) throw error;
}
