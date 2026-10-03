import { supabase } from "./supabase";

export type EmergencyShareLink = {
  id: string;
  careRecipientId: string;
  expiresAt: string;
  revokedAt: string | null;
  accessCount: number;
  lastAccessedAt: string | null;
  createdAt: string;
};

export type CreatedEmergencyShareLink = EmergencyShareLink & {
  shareUrl: string;
};

function mapShare(row: any): EmergencyShareLink {
  return {
    id: String(row.id),
    careRecipientId: String(row.care_recipient_id),
    expiresAt: String(row.expires_at),
    revokedAt: row.revoked_at ?? null,
    accessCount: Number(row.access_count ?? 0),
    lastAccessedAt: row.last_accessed_at ?? null,
    createdAt: String(row.created_at),
  };
}

export async function loadEmergencyShareLinks(careRecipientId: string) {
  const { data, error } = await supabase
    .from("emergency_share_links")
    .select(
      "id, care_recipient_id, expires_at, revoked_at, access_count, last_accessed_at, created_at",
    )
    .eq("care_recipient_id", careRecipientId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) throw error;
  return (data ?? []).map(mapShare);
}

export async function createEmergencyShareLink(input: {
  careRecipientId: string;
  expiresInMinutes: number;
}): Promise<CreatedEmergencyShareLink> {
  const { data, error } = await supabase.functions.invoke("emergency-share", {
    body: {
      action: "create",
      careRecipientId: input.careRecipientId,
      expiresInMinutes: input.expiresInMinutes,
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  if (!data?.shareId || !data?.shareUrl) {
    throw new Error("The temporary emergency link was not created.");
  }

  return {
    id: String(data.shareId),
    careRecipientId: input.careRecipientId,
    shareUrl: String(data.shareUrl),
    expiresAt: String(data.expiresAt),
    revokedAt: null,
    accessCount: 0,
    lastAccessedAt: null,
    createdAt: String(data.createdAt),
  };
}

export async function revokeEmergencyShareLink(shareId: string) {
  const { data, error } = await supabase.functions.invoke("emergency-share", {
    body: { action: "revoke", shareId },
  });

  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
}
