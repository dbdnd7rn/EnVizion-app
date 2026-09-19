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
