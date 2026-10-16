import { themeBackground, themeForeground, themeBorder, themeShadow, themeAction } from "../themeColors";
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
import { AIAtmosphere, AIGlassOrb, AIIconBubble, useAIMotionPreference } from "../components/EnVizionAIArtwork";
import { AICareTrends } from "../components/AICareTrends";
import { useNav } from "./MainScreens";

const PURPLE = "#70338F";
const INK = "#19143F";
const MUTED = "#69617E";
const glass = () => ({
  ...(Platform.OS === "web" ? { backdropFilter: "blur(18px)" } : {}),
  borderWidth: 1, borderColor: themeBorder("#E5D9ED"), borderRadius: 23,
  backgroundColor: themeBackground("#FFFDFEF0"), shadowColor: themeShadow("#5C3877"),
  shadowOpacity: 0.075, shadowRadius: 18,
  shadowOffset: { width: 0, height: 6 },
  elevation: 1,
} as const);

function ActionButton({ title, icon, onPress, disabled = false, secondary = false }: {
  title: string; icon?: string; onPress: () => void; disabled?: boolean; secondary?: boolean;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title}
      accessibilityState={{ disabled }} disabled={disabled}
      onPress={onPress} style={({ pressed }) => ({
        minHeight: 47, borderRadius: 21, paddingHorizontal: 16,
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
        backgroundColor: secondary ? themeBackground("#F5E9FB") : themeAction(PURPLE),
        borderWidth: secondary ? 1 : 0, borderColor: themeBorder("#E7D7EF"),
        opacity: disabled ? 0.45 : pressed ? 0.76 : 1,
      })}>
      {icon && <Icon name={icon} color={secondary ? themeForeground(PURPLE) : "#FFFFFF"} size={18}/>}
      <Text style={{
        fontFamily: "DMSans_600SemiBold", fontSize: 13.5,
        color: secondary ? themeForeground(PURPLE) : "#FFFFFF",
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
  { icon: "heart-outline", title: "Check in with me", prompt: "Check in with me" },
  { icon: "stats-chart-outline", title: "My care rhythm", prompt: "Show care trends" },
  { icon: "calendar-outline", title: "Set a reminder", prompt: "Help me create a reminder. Ask me for its date, time and description." },
  { icon: "document-text-outline", title: "Write a care note", prompt: "Write a care note" },
] as const;

export function EnVizionAIScreen() {
  const n = useNav();
  const reducedMotion = useAIMotionPreference();
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

  const send = useCallback(async (message: string, retry = false) => {
    const value = message.trim().slice(0, 1800);
    if (!value || busy) return;
    setProblem("");
    // Typing confirmation never saves, and leaves the editable draft available.
    const keepDraft = Boolean(pending) && /^(?:yes|ok(?:ay)?|confirm|save(?: it)?)[.!\s]*$/i.test(value);
    if (!keepDraft) setPending(null);
    const id = ++requestId.current;
    const priorMessages = retry && messages.at(-1)?.role === "user" ? messages.slice(0, -1) : messages;
    const history: AssistantHistory[] = priorMessages.slice(-12)
      .filter(m => m.role === "user" || m.role === "assistant")
      .map(m => ({ role: m.role as "user" | "assistant", content: m.text }));
    if (!retry) dispatch({ type: "conversation-turn", messages: [makeMessage("user", value)] });
    setDraftText("");
    setBusy(true);
    try {
      const response = await askCareAI({
        message: value, history,
        careRecipientId: state.careRecipientId,
        includeCareData: careDataAllowed,
      });
      if (id !== requestId.current) return;
      dispatch({ type: "conversation-turn", messages: [{ ...makeMessage("assistant", response.reply), resource: response.resource, trends: response.trends, suggestions: response.suggestions }] });
      if (response.action) setPending(response.action);
    } catch (error) {
      if (id !== requestId.current) return;
      setProblem(error instanceof Error ? error.message : "The assistant couldn't answer. Please try again.");
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  }, [busy, careDataAllowed, dispatch, messages, pending, state.careRecipientId]);

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
      <AIAtmosphere/>
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
            Your care toolkit companion
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
        {Boolean(messages.length) && (
          <View style={[glass(), { paddingHorizontal: 18, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 10 }]}>
            <AIAtmosphere variant="corner"/>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontFamily: "Lora_500Medium", fontSize: 21, color: themeForeground(INK) }}>A little support, anytime.</Text>
              <Text style={{ fontFamily: "DMSans_400Regular", fontSize: 12, color: themeForeground(MUTED) }}>Built-in toolkit guidance. No external AI.</Text>
            </View>
            <AIGlassOrb reducedMotion={reducedMotion} compact/>
          </View>
        )}
        {!messages.length && (
          <View style={[glass(), { backgroundColor: themeBackground("#F8F0FCEC"), padding: 22, gap: 15 }]}>
            <AIAtmosphere/>
            <AIGlassOrb reducedMotion={reducedMotion}/>
            <Text style={{ fontFamily: "Lora_500Medium", color: themeForeground(INK), fontSize: 29, lineHeight: 38 }}>
              Hello, {firstName}.
            </Text>
            <Text style={{ fontFamily: "DMSans_400Regular", color: themeForeground(MUTED),
              fontSize: 14, lineHeight: 22 }}>
              I can help you find your way, check saved care updates, and prepare reminders or notes. What would help today?
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>
              {starters.map(item => (
                <Pressable key={item.title} accessibilityRole="button" accessibilityLabel={item.title}
                  onPress={() => void send(item.prompt)}
                  style={({ pressed }) => ({
                    flexBasis: "46%", flexGrow: 1, minHeight: 116, padding: 14, borderRadius: 20, overflow: "hidden",
                    borderWidth: 1, borderColor: themeBorder("#E5D6ED"),
                    backgroundColor: themeBackground("#FFFFFFD9"), gap: 8,
                    opacity: pressed ? 0.82 : 1,
                    transform: [{ scale: pressed && !reducedMotion ? 0.97 : 1 }],
                    shadowColor: themeShadow("#653B82"), shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
                  })}>
                  <AIAtmosphere variant="corner"/>
                  <AIIconBubble><Icon name={item.icon} color={themeForeground(PURPLE)} size={21}/></AIIconBubble>
                  <Text style={{ fontFamily: "DMSans_600SemiBold", color: themeForeground(INK), fontSize: 12.3, lineHeight: 17 }}>
                    {item.title}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <View style={[glass(), { padding: 17, gap: 12, backgroundColor: themeBackground("#FBF7FDEB") }]}>
          <AIAtmosphere variant="corner"/>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <AIIconBubble><Icon name="shield-checkmark-outline" color={themeForeground(PURPLE)} size={22}/></AIIconBubble>
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
            This assistant uses built-in toolkit guidance. Your chat is not sent to an external AI provider.
            Enable this to use authorized records for the selected profile. Switching modes starts a fresh
            conversation. Nothing is saved to care records without your confirmation.
          </Text>
        </View>

        {messages.map(item => (
          <View key={item.id} style={[glass(), {
            maxWidth: "94%", alignSelf: item.role === "user" ? "flex-end" : "flex-start",
            backgroundColor: item.role === "user" ? themeAction(PURPLE) : themeBackground("#FFFDFFF0"),
            borderBottomRightRadius: item.role === "user" ? 7 : 22,
            borderBottomLeftRadius: item.role === "user" ? 22 : 7,
            padding: 16, gap: 9,
          }]}>
            <Text style={{ fontFamily: "DMSans_700Bold", fontSize: 10,
              letterSpacing: 1.2, color: item.role === "user" ? "#F0E3F8" : themeForeground(PURPLE) }}>
              {item.role === "user" ? "YOU" : "ENVIZION AI"}
            </Text>
            <Text selectable style={{ fontFamily: "DMSans_400Regular", fontSize: 14,
              lineHeight: 22, color: item.role === "user" ? "#FFFFFF" : themeForeground(INK) }}>
              {item.text}
            </Text>
            {item.trends && careDataAllowed && previousProfile.current === state.careRecipientId && state.careRecipientId &&
              item.id === [...messages].reverse().find(m => m.trends)?.id && (
              <AICareTrends key={state.careRecipientId + item.id} initial={item.trends} careRecipientId={state.careRecipientId}/>
            )}
            {item.id === messages.at(-1)?.id && item.suggestions && !pending && !busy && (
              <View style={{flexDirection:"row",flexWrap:"wrap",gap:8}}>
                {item.suggestions.map(suggestion => <ActionButton key={suggestion} title={suggestion} secondary onPress={()=>void send(suggestion)}/>)}
              </View>
            )}
            {item.role === "assistant" && item.resource && (
              <ActionButton title={item.resource.label} icon="arrow-forward-outline" secondary
                onPress={() => n.navigate(item.resource!.destination)}/>
            )}
            <Text style={{ fontSize: 10.5, color: item.role === "user" ? "#F0E3F8" : themeForeground(MUTED) }}>
              {new Date(item.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Text>
          </View>
        ))}
        {busy && <View accessibilityLabel="Toolkit assistant is preparing a reply" style={{ flexDirection: "row",
          alignItems: "center", gap: 10, padding: 15, borderRadius: 18, backgroundColor: themeBackground("#F6EDFB") }}>
          <ActivityIndicator color={themeForeground(PURPLE)}/>
          <Text style={{ fontFamily: "DMSans_400Regular", color: themeForeground(MUTED) }}>Checking the toolkit…</Text>
        </View>}

        {pending && (
          <View style={[glass(), { padding: 20, gap: 16, backgroundColor: themeBackground("#FBF7FDEF"), borderColor: themeBorder("#D9C1EA") }]}>
            <AIAtmosphere variant="corner"/>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: themeBorder("#E8DDED") }}>
              <AIIconBubble><Icon name="create-outline" color={themeForeground(PURPLE)} size={22}/></AIIconBubble>
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
                        borderRadius: 17, minHeight: 44, paddingHorizontal: 14,
                        justifyContent: "center",
                        backgroundColor: pending.recurrence === recurrence ? themeAction(PURPLE) : themeBackground("#FFFFFF"),
                        borderWidth: 1, borderColor: themeBorder("#E1D0EB"),
                      }}>
                      <Text style={{ fontSize: 12.5, color: pending.recurrence === recurrence ? "#FFFFFF" : themeForeground(PURPLE) }}>
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
          <View style={[glass(), { padding: 13, gap: 10, backgroundColor: themeBackground("#FFF3F5") }]}>
            <Text accessibilityRole="alert" style={{ fontSize: 12.5, lineHeight: 18, color: themeForeground("#A73556") }}>
              {problem}
            </Text>
            {!busy && <ActionButton title={pending ? "Retry saving draft" : "Retry AI reply"}
              secondary icon="refresh-outline" onPress={() => {
                if (pending) { void confirm(); return; }
                const last = [...messages].reverse().find(m => m.role === "user");
                if (last) void send(last.text, true);
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
            placeholder="Ask about your toolkit, or set a reminder…"
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
              backgroundColor: themeAction(PURPLE),
              opacity: busy || !draftText.trim() ? 0.42 : pressed ? 0.7 : 1,
            })}>
            <Icon name="send-outline" color="#FFFFFF" size={23}/>
          </Pressable>
        </View>
        <Text style={{ fontFamily: "DMSans_400Regular", color: themeForeground(MUTED), textAlign: "center",
          fontSize: 10.3, lineHeight: 15 }}>
          Toolkit guidance only. Not for emergencies, prescriptions or clinical decisions.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}
