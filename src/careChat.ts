import { supabase } from "./supabase";
import { chatSearchTerm } from "./careChatHelpers";
import { loadCareSpaces } from "./careTeam";

export type ChatPerson = { user_id: string; full_name: string | null; avatar_url: string | null };
export type ChatConversation = {
  id: string; care_recipient_id: string; kind: "group" | "direct";
  direct_user_a: string | null; direct_user_b: string | null; created_at: string;
};
export type ChatMessage = {
  id: string; conversation_id: string; sender_id: string; body: string | null;
  reply_to: string | null; client_nonce: string; created_at: string;
  edited_at: string | null; deleted_at: string | null;
};
export type ChatRead = { user_id: string; conversation_id: string; last_read_at: string };
export type ChatTyping = { user_id: string; conversation_id: string; typed_at: string };

async function checkedUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Please sign in again to use Care Team Chat.");
  return user.id;
}

export async function chatCareSpaces() { return loadCareSpaces(); }
export async function chatCurrentUser() { return checkedUser(); }

export async function chatPeople(careRecipientId: string): Promise<ChatPerson[]> {
  const { data, error } = await supabase.rpc("chat_team_people", { p_recipient: careRecipientId });
  if (error) throw error;
  return Promise.all(((data ?? []) as ChatPerson[]).map(async (person) => {
    const raw = person.avatar_url;
    if (!raw || /^https:\/\//i.test(raw)) return person;
    // Storage SELECT is scoped to currently shared active care-team memberships.
    const result = await supabase.storage.from("caregiver-avatars").createSignedUrl(raw, 3600);
    return { ...person, avatar_url: result.error ? null : (result.data?.signedUrl ?? null) };
  }));
}

export async function chatOpen(careRecipientId: string, peerId: string | null = null): Promise<string> {
  await checkedUser();
  const { data, error } = await supabase.rpc("chat_open_conversation", {
    p_recipient: careRecipientId, p_peer: peerId,
  });
  if (error || !data) throw error ?? new Error("Could not open conversation.");
  return data as string;
}

export async function chatConversations(careRecipientId: string): Promise<ChatConversation[]> {
  const { data, error } = await supabase.from("chat_conversations")
    .select("id,care_recipient_id,kind,direct_user_a,direct_user_b,created_at")
    .eq("care_recipient_id", careRecipientId).order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ChatConversation[];
}

export async function chatConversationById(id: string): Promise<ChatConversation | null> {
  const { data, error } = await supabase.from("chat_conversations")
    .select("id,care_recipient_id,kind,direct_user_a,direct_user_b,created_at")
    .eq("id", id).maybeSingle();
  if (error) throw error;
  return data as ChatConversation | null;
}

export async function chatPage(conversationId: string, before?: string): Promise<ChatMessage[]> {
  let query = supabase.from("chat_messages")
    .select("id,conversation_id,sender_id,body,reply_to,client_nonce,created_at,edited_at,deleted_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(40);
  if (before) query = query.lt("created_at", before);
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as ChatMessage[]).reverse();
}

export async function chatSearch(conversationId: string, query: string): Promise<ChatMessage[]> {
  const term = chatSearchTerm(query);
  if (!term) return [];
  const { data, error } = await supabase.from("chat_messages")
    .select("id,conversation_id,sender_id,body,reply_to,client_nonce,created_at,edited_at,deleted_at")
    .eq("conversation_id", conversationId).is("deleted_at", null)
    .ilike("body", `%${term}%`).order("created_at", { ascending: false }).limit(40);
  if (error) throw error;
  return (data ?? []) as ChatMessage[];
}

export async function chatSend(conversationId: string, body: string, nonce: string, replyTo?: string | null) {
  const actor = await checkedUser();
  const payload = { conversation_id: conversationId, sender_id: actor, body: body.trim(),
    reply_to: replyTo ?? null, client_nonce: nonce };
  const { data, error } = await supabase.from("chat_messages").insert(payload)
    .select("id,conversation_id,sender_id,body,reply_to,client_nonce,created_at,edited_at,deleted_at").single();
  if (!error) return data as ChatMessage;
  if (error.code === "23505") {
    const result = await supabase.from("chat_messages")
      .select("id,conversation_id,sender_id,body,reply_to,client_nonce,created_at,edited_at,deleted_at")
      .eq("sender_id", actor).eq("client_nonce", nonce).single();
    if (!result.error && result.data) return result.data as ChatMessage;
  }
  throw error;
}

export async function chatEdit(id: string, body: string) {
  const { error } = await supabase.from("chat_messages")
    .update({ body: body.trim(), edited_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}
export async function chatDelete(id: string) {
  const { error } = await supabase.from("chat_messages")
    .update({ body: null, deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}
export async function chatMarkRead(conversationId: string) {
  const { error } = await supabase.rpc("chat_mark_read", { p_conversation: conversationId });
  if (error) throw error;
}
export async function chatSignalTyping(conversationId: string) {
  const { error } = await supabase.rpc("chat_signal_typing", { p_conversation: conversationId });
  if (error) throw error;
}
export async function chatReadStates(conversationId: string): Promise<ChatRead[]> {
  const { data, error } = await supabase.from("chat_read_state")
    .select("conversation_id,user_id,last_read_at").eq("conversation_id", conversationId);
  if (error) throw error;
  return (data ?? []) as ChatRead[];
}
export async function chatTypingStates(conversationId: string): Promise<ChatTyping[]> {
  const { data, error } = await supabase.from("chat_typing_state")
    .select("conversation_id,user_id,typed_at").eq("conversation_id", conversationId);
  if (error) throw error;
  return (data ?? []) as ChatTyping[];
}
export async function chatUnreadCount(conversationId: string, lastRead: string | null, userId: string): Promise<number> {
  let query = supabase.from("chat_messages")
    .select("id", { head: true, count: "exact" }).eq("conversation_id", conversationId).neq("sender_id", userId).is("deleted_at", null);
  if (lastRead) query = query.gt("created_at", lastRead);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

/** A fresh subscription + authoritative reload handles dropped networks without trusting cached messages. */
export function chatSubscribe(conversationId: string, onMessages: () => void, onStatus: () => void) {
  const channel = supabase.channel("care-chat:" + conversationId + ":" + Math.random().toString(36).slice(2))
    .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages",
      filter: "conversation_id=eq." + conversationId }, onMessages)
    .on("postgres_changes", { event: "*", schema: "public", table: "chat_read_state",
      filter: "conversation_id=eq." + conversationId }, onStatus)
    .on("postgres_changes", { event: "*", schema: "public", table: "chat_typing_state",
      filter: "conversation_id=eq." + conversationId }, onStatus)
    .subscribe(status => { if (status === "SUBSCRIBED") { onMessages(); onStatus(); } });
  return () => { void supabase.removeChannel(channel); };
}

export { mergeChatMessages } from "./careChatHelpers";
