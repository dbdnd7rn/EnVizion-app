import { supabase } from "./supabase";

export type SessionSecuritySummary = {
  active: boolean;
  expiresAt: string | null;
  expiresInMinutes: number | null;
};

export function sessionExpiryLabel(
  expiresAt: string | null,
  now = new Date(),
) {
  if (!expiresAt) return "Session expiry unavailable";
  const at = new Date(expiresAt);
  if (!Number.isFinite(at.getTime())) return "Session expiry unavailable";
  const minutes = Math.max(
    0,
    Math.ceil((at.getTime() - now.getTime()) / 60_000),
  );
  if (minutes <= 1) return "Session refresh due very soon";
  if (minutes < 60) return `Session refresh in about ${minutes} minutes`;
  return `Session refresh in about ${Math.ceil(minutes / 60)} hours`;
}

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
