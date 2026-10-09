import { themeBackground, themeForeground, themeBorder, themeShadow } from "../themeColors";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  Switch, Text, TextInput, View,
} from "react-native";
import { useCare } from "../store";
import { makeMessage } from "../assistant/model";
import {
  askCareAI, validateAssistantDraft,
  type AssistantDraft, type AssistantHistory,
} from "../assistant/careAI";
import {
  createCareReminder, detectedTimezone, localDateTimeToIso,
} from "../reminders";
import { createCareCommunication } from "../careCommunications";
import { Icon } from "../ui";
import { useNav } from "./MainScreens";

const PURPLE = "#70338F";
const INK = "#19143F";
const MUTED = "#79728E";
const glass = {
  borderWidth: 1, borderColor: themeBorder("#E5D9ED"), borderRadius: 23,
  backgroundColor: themeBackground("#FFFDFEF0"), shadowColor: themeShadow("#5C3877"),
  shadowOpacity: 0.055, shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 1,
} as const;

function ActionButton({ title, icon, onPress, disabled = false, secondary = false }: {
  title: string; icon?: string; onPress: () => void; disabled?: boolean; secondary?: boolean;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title}
      accessibilityState={{ disabled }} disabled={disabled}
      onPress={onPress} style={({ pressed }) => ({
        minHeight: 47, borderRadius: 21, paddingHorizontal: 16,
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
        backgroundColor: secondary ? "#F5E9FB" : PURPLE,
        borderWidth: secondary ? 1 : 0, borderColor: themeBorder("#E7D7EF"),
        opacity: disabled ? 0.45 : pressed ? 0.76 : 1,
      })}>
      {icon && <Icon name={icon} color={secondary ? PURPLE : "#FFFFFF"} size={18}/>}
      <Text style={{
        fontFamily: "DMSans_600SemiBold", fontSize: 13.5,
        color: secondary ? PURPLE : "#FFFFFF",
      }}>{title}</Text>
    </Pressable>
  );
}

function Editable({ label, value, onChange, multiline = false }: {
  label: string; value: string; onChange: (v: string) => void; multiline?: boolean;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: "DMSans_600SemiBold", fontSize: 12.5, color: themeForeground(INK) }}>{label}</Text>
      <TextInput accessibilityLabel={label} value={value} onChangeText={onChange}
        multiline={multiline} maxLength={multiline ? 1400 : 180}
        placeholderTextColor={themeForeground("#A19AAF")}
        style={{
          borderWidth: 1, borderColor: themeBorder("#DDCEE9"), borderRadius: 14,
          paddingHorizontal: 13, paddingVertical: 12,
          minHeight: multiline ? 100 : 46, color: themeForeground(INK),
          textAlignVertical: multiline ? "top" : "center",
          fontFamily: "DMSans_400Regular", fontSize: 14,
          backgroundColor: themeBackground("#FFFFFF"),
        }}/>
    </View>
  );
}

const starters = [
  { icon: "heart-outline", title: "Check in with me", prompt: "Hi! How are you? I'd like to chat for a bit." },
  { icon: "people-outline", title: "Care updates", prompt: "What should I know about our current care plan and tasks?" },
  { icon: "calendar-outline", title: "Set a reminder", prompt: "Help me create a reminder. Ask me for its date, time and description." },
  { icon: "document-text-outline", title: "Write a care note", prompt: "Help me put an update into a clear care communication note to review and save." },
] as const;

export function EnVizionAIScreen() {
  const n = useNav();
  const { state, dispatch } = useCare();
  const scroll = useRef<ScrollView>(null);
  const [draftText, setDraftText] = useState("");
  const [careDataAllowed, setCareDataAllowed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState("");
  const [pending, setPending] = useState<AssistantDraft | null>(null);
  const previousProfile = useRef(state.careRecipientId);
  const requestId = useRef(0);
  const firstName = state.name.trim().split(/\s+/)[0] || "there";
  const canEdit = (state.accessRole === "owner" || state.accessRole === "caregiver") &&
    Boolean(state.careRecipientId);
  const messages = state.conversation.messages;

  useEffect(() => {
    if (previousProfile.current === state.careRecipientId) return;
    previousProfile.current = state.careRecipientId;
    requestId.current += 1;
    dispatch({ type: "conversation-clear" });
    setPending(null);
    setCareDataAllowed(false);
    setProblem("");
    setBusy(false);
  }, [dispatch, state.careRecipientId]);

  const send = useCallback(async (message: string) => {
    const value = message.trim().slice(0, 1800);
    if (!value || busy) return;
    setProblem("");
    setPending(null);
    const id = ++requestId.current;
    const history: AssistantHistory[] = messages.slice(-12)
      .filter(m => m.role === "user" || m.role === "assistant")
      .map(m => ({ role: m.role as "user" | "assistant", content: m.text }));
    dispatch({ type: "conversation-turn", messages: [makeMessage("user", value)] });
    setDraftText("");
    setBusy(true);
    try {
      const response = await askCareAI({
        message: value, history,
        careRecipientId: state.careRecipientId,
        includeCareData: careDataAllowed,
      });
      if (id !== requestId.current) return;
      dispatch({ type: "conversation-turn", messages: [makeMessage("assistant", response.reply)] });
      if (response.action) setPending(response.action);
    } catch (error) {
      if (id !== requestId.current) return;
      setProblem(error instanceof Error ? error.message : "The assistant couldn't answer. Please try again.");
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  }, [busy, careDataAllowed, dispatch, messages, state.careRecipientId]);

  const editPending = (changes: Partial<Record<string,string>>) => {
    if (!pending) return;
    setPending({ ...pending, ...changes } as AssistantDraft);
    setProblem("");
  };

  const confirm = async () => {
    if (!pending || !state.careRecipientId || !canEdit || saving) return;
    const checked = validateAssistantDraft(pending);
    if (!checked) { setProblem("Check all draft fields before saving."); return; }
    setProblem("");
    setSaving(true);
    try {
      if (checked.type === "create_reminder") {
        const iso = localDateTimeToIso(checked.date, checked.time);
        if (!iso || new Date(iso).getTime() <= Date.now()) {
          throw new Error("Choose a valid future date and time in your local timezone.");
        }
        await createCareReminder({
          careRecipientId: state.careRecipientId,
          title: checked.title, note: checked.note,
          reminderType: "general", scheduledFor: iso,
          timezone: detectedTimezone(), recurrence: checked.recurrence,
          notifyScope: "creator",
        });
        dispatch({ type: "conversation-turn", messages: [
          makeMessage("assistant", `Saved the reminder “${checked.title}” for ${checked.date} at ${checked.time} (${detectedTimezone()}). You can manage it in the app's reminders.`),
        ]});
      } else {
        await createCareCommunication(state.careRecipientId, {
          contactId: null, communicationType: "other",
          occurredAt: new Date().toISOString(),
          personSpokenTo: "", organizationName: "", summary: checked.summary,
          outcome: "", followUpNeeded: false, followUpAt: null,
          notes: checked.notes, priority: "routine", tag: "Caregiver note",
        });
        dispatch({ type: "conversation-turn", messages: [
          makeMessage("assistant", "Your care communication note was saved. You can review it in Care notes & communication log."),
        ]});
      }
      setPending(null);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "Couldn't save the draft. Nothing was changed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: themeBackground("#FFFCFB") }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 10,
        borderBottomWidth: 1, borderBottomColor: themeBorder("#ECE2F1") }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back"
          onPress={() => n.goBack()} style={{
            width: 44, height: 44, alignItems: "center", justifyContent: "center",
          }}>
          <Icon name="arrow-back-outline" color={themeForeground(PURPLE)} size={25}/>
        </Pressable>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: "DMSans_700Bold", fontSize: 18, color: themeForeground(INK) }}>EnVizion AI</Text>
          <Text style={{ fontFamily: "DMSans_400Regular", fontSize: 11.5, color: themeForeground(MUTED) }}>
            Chat, understand, prepare and organize
          </Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Start a new AI conversation"
          disabled={busy||saving} onPress={() => {
            requestId.current += 1;
            dispatch({ type: "conversation-clear" });
            setPending(null); setProblem("");
          }} style={{
            width: 44, height: 44, borderRadius: 22, backgroundColor: themeBackground("#F5EBFB"),
            alignItems: "center", justifyContent: "center",
          }}>
          <Icon name="create-outline" color={themeForeground(PURPLE)} size={21}/>
        </Pressable>
      </View>

      <ScrollView ref={scroll} style={{ flex: 1 }} automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive"
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
        contentContainerStyle={{ paddingHorizontal: 17, paddingVertical: 16, gap: 13 }}>
        {!messages.length && (
          <View style={[glass, { backgroundColor: themeBackground("#F8F0FCEC"), padding: 22, gap: 15 }]}>
            <View style={{ width: 49, height: 49, borderRadius: 20, backgroundColor: themeBackground("#E6D1F5"),
              alignItems: "center", justifyContent: "center" }}>
              <Icon name="sparkles-outline" color={themeForeground(PURPLE)} size={26}/>
            </View>
            <Text style={{ fontFamily: "Lora_500Medium", color: themeForeground(INK), fontSize: 27, lineHeight: 35 }}>
              Hello, {firstName}.
            </Text>
            <Text style={{ fontFamily: "DMSans_400Regular", color: themeForeground(MUTED),
              fontSize: 14, lineHeight: 22 }}>
              I'm here to talk, answer questions, and help prepare your care tasks. What’s on your mind?
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>
              {starters.map(item => (
                <Pressable key={item.title} accessibilityRole="button" accessibilityLabel={item.title}
                  onPress={() => void send(item.prompt)}
                  style={({ pressed }) => ({
                    width: "47.5%", minHeight: 93, padding: 12, borderRadius: 18,
                    borderWidth: 1, borderColor: themeBorder("#E5D6ED"),
                    backgroundColor: themeBackground("#FFFFFFD9"), gap: 8,
                    opacity: pressed ? 0.72 : 1,
                  })}>
                  <Icon name={item.icon} color={themeForeground(PURPLE)} size={21}/>
                  <Text style={{ fontFamily: "DMSans_600SemiBold", color: themeForeground(INK), fontSize: 12.3, lineHeight: 17 }}>
                    {item.title}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <View style={[glass, { padding: 14, backgroundColor: themeBackground("#F9F3FD") }]}>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <Icon name="shield-checkmark-outline" color={themeForeground(PURPLE)} size={23}/>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ color: themeForeground(INK), fontFamily: "DMSans_600SemiBold", fontSize: 13 }}>
                Use this care profile's information
              </Text>
              <Text style={{ color: themeForeground(MUTED), fontFamily: "DMSans_400Regular",
                fontSize: 11.5, lineHeight: 16.5 }}>
                {state.careRecipientId
                  ? `Selected: ${state.careRecipientName || "Your care profile"}`
                  : "Select a care profile first"}
              </Text>
            </View>
            <Switch value={careDataAllowed}
              disabled={!state.careRecipientId || busy}
              accessibilityLabel="Share authorized care profile data with the AI for this conversation"
              onValueChange={(v) => {
                // The old chat can contain private record excerpts. Do not send it
                // to the provider under a different privacy preference.
                requestId.current += 1;
                setBusy(false);
                dispatch({ type: "conversation-clear" });
                setCareDataAllowed(v);
                setPending(null);
                setProblem("");
              }}
              trackColor={{ false: "#D9D4DE", true: "#D2AAE5" }} thumbColor={PURPLE}/>
          </View>
          <Text style={{ fontFamily: "DMSans_400Regular", color: themeForeground(MUTED),
            fontSize: 10.8, lineHeight: 16 }}>
            AI processes your messages through a third-party provider. When enabled, relevant authorized
            care records also go to the provider for that chat. Switching modes starts a fresh
            conversation. Nothing is saved to care records without your confirmation.
          </Text>
        </View>

        {messages.map(item => (
          <View key={item.id} style={[glass, {
            maxWidth: "94%", alignSelf: item.role === "user" ? "flex-end" : "flex-start",
            backgroundColor: item.role === "user" ? PURPLE : "#FFFFFF",
            borderBottomRightRadius: item.role === "user" ? 7 : 22,
            borderBottomLeftRadius: item.role === "user" ? 22 : 7,
            padding: 14, gap: 9,
          }]}>
            <Text style={{ fontFamily: "DMSans_700Bold", fontSize: 10,
              letterSpacing: 1.2, color: item.role === "user" ? "#E9D5F5" : PURPLE }}>
              {item.role === "user" ? "YOU" : "ENVIZION AI"}
            </Text>
            <Text selectable style={{ fontFamily: "DMSans_400Regular", fontSize: 14,
              lineHeight: 22, color: item.role === "user" ? "#FFFFFF" : INK }}>
              {item.text}
            </Text>
            <Text style={{ fontSize: 10.5, color: item.role === "user" ? "#E9D5F5" : MUTED }}>
              {new Date(item.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Text>
          </View>
        ))}
        {busy && <View accessibilityLabel="AI is composing a reply" style={{ flexDirection: "row",
          alignItems: "center", gap: 10, padding: 15, borderRadius: 18, backgroundColor: themeBackground("#F6EDFB") }}>
          <ActivityIndicator color={themeForeground(PURPLE)}/>
          <Text style={{ fontFamily: "DMSans_400Regular", color: themeForeground(MUTED) }}>Thinking about your question…</Text>
        </View>}

        {pending && (
          <View style={[glass, { padding: 17, gap: 14, backgroundColor: themeBackground("#F8F1FC") }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
              <Icon name="create-outline" color={themeForeground(PURPLE)} size={23}/>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "DMSans_700Bold", color: themeForeground(INK), fontSize: 16 }}>Review before saving</Text>
                <Text style={{ fontFamily: "DMSans_400Regular", color: themeForeground(MUTED), fontSize: 12 }}>
                  {pending.type === "create_reminder" ? "Reminder draft" : "Care communication note draft"}
                </Text>
              </View>
            </View>
            {pending.type === "create_reminder" ? (
              <>
                <Editable label="Reminder title" value={pending.title} onChange={v => editPending({ title: v })}/>
                <Editable label="Optional note" value={pending.note} onChange={v => editPending({ note: v })} multiline/>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Editable label="Date (YYYY-MM-DD)" value={pending.date} onChange={v => editPending({ date: v })}/>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Editable label="Time (HH:MM)" value={pending.time} onChange={v => editPending({ time: v })}/>
                  </View>
                </View>
                <Text style={{ color: themeForeground(MUTED), fontSize: 12 }}>Local timezone: {detectedTimezone()}</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {(["none", "daily", "weekly"] as const).map(recurrence => (
                    <Pressable key={recurrence} accessibilityRole="button" accessibilityLabel={`Repeat ${recurrence}`}
                      accessibilityState={{ selected: pending.recurrence === recurrence }}
                      onPress={() => editPending({ recurrence })}
                      style={{
                        borderRadius: 17, minHeight: 43, paddingHorizontal: 14,
                        justifyContent: "center",
                        backgroundColor: pending.recurrence === recurrence ? PURPLE : "#FFFFFF",
                        borderWidth: 1, borderColor: themeBorder("#E1D0EB"),
                      }}>
                      <Text style={{ fontSize: 12.5, color: pending.recurrence === recurrence ? "#FFFFFF" : PURPLE }}>
                        {recurrence === "none" ? "Once" : recurrence === "daily" ? "Daily" : "Weekly"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : (
              <>
                <Editable label="Note summary" value={pending.summary} onChange={v => editPending({ summary: v })}/>
                <Editable label="Details" value={pending.notes} onChange={v => editPending({ notes: v })} multiline/>
                <Text style={{ fontFamily: "DMSans_400Regular", color: themeForeground(MUTED), fontSize: 11.5, lineHeight: 17 }}>
                  This note will be saved in the selected care profile’s communication log and may be seen by its authorized care team.
                </Text>
              </>
            )}
            {!canEdit && <Text accessibilityRole="alert" style={{ color: themeForeground("#A84160"), fontSize: 12.5 }}>
              Your account cannot edit this care profile. Ask an authorized caregiver to save it.
            </Text>}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <ActionButton title="Discard" icon="close-outline" secondary
                  disabled={saving} onPress={() => setPending(null)}/>
              </View>
              <View style={{ flex: 1.3 }}>
                <ActionButton title={saving ? "Saving…" : "Confirm & save"} icon="checkmark-outline"
                  disabled={saving || busy || !canEdit} onPress={() => void confirm()}/>
              </View>
            </View>
          </View>
        )}

        {Boolean(problem) && (
          <View style={[glass, { padding: 13, gap: 10, backgroundColor: themeBackground("#FFF3F5") }]}>
            <Text accessibilityRole="alert" style={{ fontSize: 12.5, lineHeight: 18, color: themeForeground("#A73556") }}>
              {problem}
            </Text>
            {!busy && <ActionButton title={pending ? "Retry saving draft" : "Retry AI reply"}
              secondary icon="refresh-outline" onPress={() => {
                if (pending) { void confirm(); return; }
                const last = [...messages].reverse().find(m => m.role === "user");
                if (last) void send(last.text);
                else setProblem("");
              }}/>}
          </View>
        )}
      </ScrollView>

      <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: themeBorder("#EDE3F2"),
        gap: 7, backgroundColor: themeBackground("#FFFCFB") }}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 9 }}>
          <TextInput value={draftText} onChangeText={setDraftText} multiline
            accessibilityLabel="Message EnVizion AI"
            placeholder="Ask me anything, or request a reminder…"
            placeholderTextColor={themeForeground("#958DA4")} maxLength={1800}
            style={{
              flex: 1, minHeight: 50, maxHeight: 125,
              borderWidth: 1, borderColor: themeBorder("#E0D3EA"),
              borderRadius: 22, paddingHorizontal: 15, paddingVertical: 13,
              color: themeForeground(INK), fontFamily: "DMSans_400Regular",
              fontSize: 14, lineHeight: 20, backgroundColor: themeBackground("#FFFFFF"),
            }}/>
          <Pressable accessibilityRole="button" accessibilityLabel="Send to EnVizion AI"
            disabled={busy || !draftText.trim()}
            onPress={() => void send(draftText)}
            style={({ pressed }) => ({
              width: 51, height: 51, borderRadius: 25,
              alignItems: "center", justifyContent: "center",
              backgroundColor: themeBackground(PURPLE),
              opacity: busy || !draftText.trim() ? 0.42 : pressed ? 0.7 : 1,
            })}>
            <Icon name="send-outline" color={themeForeground("#FFFFFF")} size={23}/>
          </Pressable>
        </View>
        <Text style={{ fontFamily: "DMSans_400Regular", color: themeForeground(MUTED), textAlign: "center",
          fontSize: 10.3, lineHeight: 15 }}>
          AI can make mistakes. Not for emergencies, prescriptions or clinical decisions.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}
