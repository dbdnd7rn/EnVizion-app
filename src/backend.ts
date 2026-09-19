import { supabase } from "./supabase";

export type SavedOnboarding = {
  name: string;
  careName: string;
  relationship: string;
  faith: boolean;
  careRecipientId: string;
};

export async function loadSavedOnboarding(): Promise<SavedOnboarding | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: profile }, { data: preferences }, { data: recipient }] =
    await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
      supabase
        .from("user_preferences")
        .select("faith_encouragement")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("care_recipients")
        .select("id, display_name, relationship")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

  if (!recipient) return null;

  return {
    name: profile?.full_name || user.user_metadata?.full_name || "",
    careName: recipient.display_name,
    relationship: recipient.relationship || "A loved one",
    faith: preferences?.faith_encouragement ?? false,
    careRecipientId: recipient.id,
  };
}

export async function saveOnboarding(input: {
  name: string;
  careName: string;
  relationship: string;
  faith: boolean;
}): Promise<SavedOnboarding> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Your session expired. Please sign in again.");
  }

  const name = input.name.trim();
  const careName = input.careName.trim();

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: user.id,
    full_name: name,
  });
  if (profileError) throw profileError;

  const { error: preferenceError } = await supabase
    .from("user_preferences")
    .upsert({
      user_id: user.id,
      faith_encouragement: input.faith,
    });
  if (preferenceError) throw preferenceError;

  const { data: existing, error: existingError } = await supabase
    .from("care_recipients")
    .select("id")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;

  let careRecipientId = existing?.id;

  if (careRecipientId) {
    const { error } = await supabase
      .from("care_recipients")
      .update({
        display_name: careName,
        relationship: input.relationship,
      })
      .eq("id", careRecipientId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase
      .from("care_recipients")
      .insert({
        owner_id: user.id,
        display_name: careName,
        relationship: input.relationship,
      })
      .select("id")
      .single();
    if (error) throw error;
    careRecipientId = data.id;
  }

  return {
    name,
    careName,
    relationship: input.relationship,
    faith: input.faith,
    careRecipientId,
  };
}


export async function updateFaithPreference(faith: boolean) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw new Error("Please sign in again.");

  const { error } = await supabase.from("user_preferences").upsert({
    user_id: user.id,
    faith_encouragement: faith,
  });

  if (error) throw error;
}

export async function submitCoachingRequest(topic: string) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw new Error("Please sign in again.");

  const { data: recipient } = await supabase
    .from("care_recipients")
    .select("id")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("coaching_requests").insert({
    user_id: user.id,
    care_recipient_id: recipient?.id ?? null,
    topic,
    status: "submitted",
  });

  if (error) throw error;
}


export type SupportRequestRecord = {
  id: string;
  topic: string;
  context: string;
  preferred_channel: "In-app inbox" | "WhatsApp" | "Email";
  status: "submitted" | "in_review" | "responded" | "closed";
  created_at: string;
};

export type SupportMessageRecord = {
  id: string;
  sender_type: "caregiver" | "staff";
  body: string;
  created_at: string;
};

export async function createSupportRequest(input: {
  topic: string;
  context: string;
  preferredChannel: "In-app inbox" | "WhatsApp" | "Email";
  includeAssistantContext: boolean;
}) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw new Error("Please sign in again.");

  const { data: recipient } = await supabase
    .from("care_recipients")
    .select("id")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("support_requests")
    .insert({
      user_id: user.id,
      care_recipient_id: recipient?.id ?? null,
      topic: input.topic,
      context: input.context.trim(),
      preferred_channel: input.preferredChannel,
      include_assistant_context: input.includeAssistantContext,
      status: "submitted",
    })
    .select("id, topic, context, preferred_channel, status, created_at")
    .single();

  if (error) throw error;
  return data as SupportRequestRecord;
}

export async function loadLatestSupportRequest(): Promise<{
  request: SupportRequestRecord | null;
  messages: SupportMessageRecord[];
}> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { request: null, messages: [] };

  const { data: request, error } = await supabase
    .from("support_requests")
    .select("id, topic, context, preferred_channel, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!request) return { request: null, messages: [] };

  const { data: messages, error: messagesError } = await supabase
    .from("support_messages")
    .select("id, sender_type, body, created_at")
    .eq("request_id", request.id)
    .order("created_at", { ascending: true });

  if (messagesError) throw messagesError;

  return {
    request: request as SupportRequestRecord,
    messages: (messages ?? []) as SupportMessageRecord[],
  };
}

export async function sendSupportMessage(requestId: string, body: string) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw new Error("Please sign in again.");

  const { error } = await supabase.from("support_messages").insert({
    request_id: requestId,
    user_id: user.id,
    sender_type: "caregiver",
    body: body.trim(),
  });

  if (error) throw error;
}
