import React, { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useCare } from "../store";
import {
  createSupportRequest,
  loadLatestSupportRequest,
  sendSupportMessage,
  type SupportMessageRecord,
  type SupportRequestRecord,
} from "../backend";
import {
  makeMessage,
  previewReply,
  starters,
  type Message,
  type SupportRequest,
} from "../assistant/model";
import {
  Button,
  C,
  Card,
  Fade,
  Field,
  Heading,
  Icon,
  Page,
  Row,
  S,
  Safety,
  Section,
  Txt,
} from "../ui";
import { useNav } from "./MainScreens";

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: C.line,
    backgroundColor: C.white,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: C.deep,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: C.lavender,
  },
  bubble: {
    maxWidth: "94%",
    gap: 9,
    padding: 17,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.white,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: C.deep,
    borderBottomRightRadius: 6,
  },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: C.white,
    borderBottomLeftRadius: 6,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DED5E4",
    backgroundColor: C.white,
  },
  composer: {
    padding: 16,
    paddingBottom: 14,
    gap: 8,
    borderTopWidth: 1,
    borderColor: C.line,
    backgroundColor: C.white,
  },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 10 },

  assistantTopbar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
  },
  assistantBack: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8F5FB",
  },
  assistantTopTitle: {
    fontFamily: "DMSans_700Bold",
    fontSize: 22,
    lineHeight: 28,
    color: "#12143D",
  },
  assistantTopSub: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    lineHeight: 18,
    color: "#8A879A",
  },
  assistantGuideBadge: {
    marginLeft: "auto",
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#F1EAFE",
  },
  assistantGuideText: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 12,
    color: "#6D32A3",
  },
  assistantHero: {
    marginHorizontal: 20,
    borderRadius: 30,
    minHeight: 300,
    padding: 22,
    overflow: "hidden",
    backgroundColor: "#F0EEFF",
    borderWidth: 1,
    borderColor: "#ECE8FF",
  },
  assistantHeroGlowOne: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    right: -70,
    top: -76,
    backgroundColor: "#E1E7FF",
    opacity: 0.8,
  },
  assistantHeroGlowTwo: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    right: 4,
    bottom: -115,
    backgroundColor: "#EADDFC",
    opacity: 0.75,
  },
  assistantGreeting: {
    fontFamily: "DMSans_700Bold",
    fontSize: 14,
    color: "#713BA0",
    marginBottom: 10,
  },
  assistantHeroTitle: {
    width: "64%",
    fontFamily: "DMSans_700Bold",
    fontSize: 32,
    lineHeight: 37,
    color: "#10133F",
  },
  assistantHeroBody: {
    width: "62%",
    marginTop: 10,
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    lineHeight: 21,
    color: "#777589",
  },
  assistantRobot: {
    position: "absolute",
    right: 5,
    top: 46,
    width: 142,
    height: 166,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  assistantRobotAntennaStem: {
    width: 6,
    height: 20,
    borderRadius: 3,
    backgroundColor: "#252755",
  },
  assistantRobotAntenna: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginTop: -2,
    marginBottom: -2,
    backgroundColor: "#FFFFFF",
    borderWidth: 4,
    borderColor: "#E4E8FF",
  },
  assistantRobotShell: {
    width: 112,
    height: 88,
    borderRadius: 35,
    padding: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E5F4",
    shadowColor: "#39345A",
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  assistantRobotFace: {
    flex: 1,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#17194A",
  },
  assistantRobotBody: {
    width: 72,
    height: 62,
    marginTop: -5,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E5F4",
  },
  assistantRobotArm: {
    position: "absolute",
    left: 0,
    bottom: 18,
    width: 38,
    height: 16,
    borderRadius: 10,
    transform: [{ rotate: "-25deg" }],
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E5F4",
  },
  assistantHeroPills: {
    marginTop: 26,
    flexDirection: "row",
    gap: 8,
  },
  assistantHeroPill: {
    flex: 1,
    minHeight: 62,
    paddingHorizontal: 9,
    paddingVertical: 9,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.88)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.95)",
  },
  assistantHeroPillLabel: {
    marginTop: 4,
    textAlign: "center",
    fontFamily: "DMSans_600SemiBold",
    fontSize: 10,
    lineHeight: 13,
    color: "#24264B",
  },
  assistantQuickGrid: {
    marginTop: 18,
    paddingHorizontal: 20,
    flexDirection: "row",
    gap: 10,
  },
  assistantQuickCard: {
    flex: 1,
    minHeight: 112,
    borderRadius: 22,
    paddingHorizontal: 9,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#F0EBF2",
  },
  assistantQuickIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.68)",
  },
  assistantQuickLabel: {
    marginTop: 9,
    textAlign: "center",
    fontFamily: "DMSans_600SemiBold",
    fontSize: 11,
    lineHeight: 14,
    color: "#191B45",
  },
  assistantSectionHeader: {
    paddingHorizontal: 20,
    marginTop: 28,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  assistantSectionTitle: {
    fontFamily: "DMSans_700Bold",
    fontSize: 21,
    color: "#14163F",
  },
  assistantViewAll: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 12,
    color: "#713BA0",
  },
  assistantQuestionList: {
    paddingHorizontal: 20,
    gap: 10,
  },
  assistantQuestionCard: {
    minHeight: 82,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E9E4EE",
  },
  assistantQuestionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1EBFC",
  },
  assistantQuestionTitle: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 14,
    lineHeight: 18,
    color: "#171943",
  },
  assistantQuestionSub: {
    marginTop: 3,
    fontFamily: "DMSans_400Regular",
    fontSize: 11,
    lineHeight: 15,
    color: "#9A96A7",
  },
  assistantResourceGrid: {
    marginTop: 26,
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: "row",
    gap: 10,
  },
  assistantResourceCard: {
    flex: 1,
    minHeight: 112,
    borderRadius: 22,
    paddingHorizontal: 8,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#F0EBF2",
  },
  assistantResourceLabel: {
    marginTop: 8,
    textAlign: "center",
    fontFamily: "DMSans_600SemiBold",
    fontSize: 10,
    lineHeight: 14,
    color: "#292B4D",
  },
  assistantComposerWrap: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#F3EEF4",
  },
  assistantComposerShell: {
    minHeight: 60,
    borderRadius: 30,
    paddingLeft: 10,
    paddingRight: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6DFEB",
    shadowColor: "#2E2135",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  assistantAttach: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F6F2FB",
  },
  assistantSend: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#713BA0",
  },
  assistantDisclaimer: {
    marginTop: 8,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  assistantDisclaimerText: {
    flex: 1,
    fontFamily: "DMSans_400Regular",
    fontSize: 10,
    lineHeight: 14,
    color: "#9A96A7",
  },
  assistantChatIntro: {
    marginBottom: 4,
    padding: 15,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F3EFFF",
    borderWidth: 1,
    borderColor: "#E8E1F4",
  },
  assistantChatOrb: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#713BA0",
  },
});

function Badge({ text }: { text: string }) {
  return (
    <View style={styles.badge}>
      <Text
        style={[S.small, { fontFamily: "DMSans_600SemiBold", color: C.deep }]}
      >
        {text}
      </Text>
    </View>
  );
}

function Bubble({ message }: { message: Message }) {
  const n = useNav();
  const own = message.role === "user";
  return (
    <View
      style={[
        styles.bubble,
        {
          alignSelf: own ? "flex-end" : "flex-start",
          backgroundColor: own ? C.deep : C.white,
          borderBottomRightRadius: own ? 6 : 20,
          borderBottomLeftRadius: own ? 20 : 6,
        },
      ]}
    >
      <Text style={[S.eyebrow, { color: own ? "#E0CBE8" : C.purple }]}>
        {own
          ? "YOU"
          : message.role === "staff"
            ? "ENVIZION SUPPORT"
            : "ENVIZION ASSISTANT"}
      </Text>
      <Text
        selectable
        style={[
          S.body,
          { color: own ? C.white : C.ink, fontSize: 15, lineHeight: 24 },
        ]}
      >
        {message.text}
      </Text>
      {message.resource && (
        <Button
          title={message.resource.label}
          secondary
          icon="arrow-forward-outline"
          onPress={() => n.navigate(message.resource!.destination)}
        />
      )}
      {message.suggestTeam && (
        <Button
          title="Talk to our team"
          secondary
          icon="people-outline"
          onPress={() => n.navigate("Handoff")}
        />
      )}
      <Text style={[S.small, { color: own ? "#DDCAE5" : C.muted }]}>
        {new Date(message.at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </Text>
    </View>
  );
}

function Composer({
  onSend,
  disabled = false,
  label = "Your message",
  placeholder = "Ask anything about caregiving…",
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const ready = Boolean(text.trim()) && !disabled;

  return (
    <View style={styles.assistantComposerWrap}>
      <View style={styles.assistantComposerShell}>
        <View style={styles.assistantAttach}>
          <Icon name="attach-outline" color="#6D6590" size={21} />
        </View>
        <TextInput
          value={text}
          onChangeText={setText}
          accessibilityLabel={label}
          placeholder={placeholder}
          placeholderTextColor="#9D98AA"
          multiline
          maxLength={1200}
          editable={!disabled}
          style={{
            flex: 1,
            minHeight: 48,
            maxHeight: 110,
            paddingVertical: 13,
            fontFamily: "DMSans_400Regular",
            fontSize: 14,
            lineHeight: 20,
            color: "#171943",
            textAlignVertical: "center",
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send message"
          disabled={!ready}
          onPress={() => {
            const value = text.trim();
            if (!value || disabled) return;
            onSend(value);
            setText("");
          }}
          style={({ pressed }) => [
            styles.assistantSend,
            { opacity: !ready ? 0.4 : pressed ? 0.76 : 1 },
          ]}
        >
          <Icon name="paper-plane-outline" color="#FFFFFF" size={22} />
        </Pressable>
      </View>
      <View style={styles.assistantDisclaimer}>
        <Icon name="information-circle-outline" color="#9A96A7" size={15} />
        <Text style={styles.assistantDisclaimerText}>
          AI provides general guidance and is not a substitute for professional
          medical advice. For emergencies, use your local emergency services.
        </Text>
      </View>
    </View>
  );
}

function AssistantFeaturePill({
  icon,
  label,
  tint,
  active = false,
  onPress,
}: {
  icon: string;
  label: string;
  tint: string;
  active?: boolean;
  onPress?: () => void;
}) {
  const body = (
    <View
      style={[
        styles.assistantHeroPill,
        active && { borderColor: tint, backgroundColor: "#FFFFFF" },
      ]}
    >
      <Icon name={icon} color={tint} size={20} />
      <Text style={styles.assistantHeroPillLabel}>{label}</Text>
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{ flex: 1 }}
    >
      {body}
    </Pressable>
  );
}

function AssistantRobot() {
  return (
    <View pointerEvents="none" style={styles.assistantRobot}>
      <View style={styles.assistantRobotAntenna} />
      <View style={styles.assistantRobotAntennaStem} />
      <View style={styles.assistantRobotShell}>
        <View style={styles.assistantRobotFace}>
          <Icon name="happy-outline" color="#8BA2FF" size={46} />
        </View>
      </View>
      <View style={styles.assistantRobotBody}>
        <Icon name="heart" color="#B977CE" size={24} />
      </View>
      <View style={styles.assistantRobotArm} />
    </View>
  );
}

function AssistantQuickCard({
  icon,
  label,
  background,
  iconColor,
  onPress,
}: {
  icon: string;
  label: string;
  background: string;
  iconColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.assistantQuickCard,
        { backgroundColor: background, opacity: pressed ? 0.75 : 1 },
      ]}
    >
      <View style={styles.assistantQuickIcon}>
        <Icon name={icon} color={iconColor} size={23} />
      </View>
      <Text style={styles.assistantQuickLabel}>{label}</Text>
    </Pressable>
  );
}

function AssistantQuestion({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.assistantQuestionCard,
        { opacity: pressed ? 0.72 : 1 },
      ]}
    >
      <View style={styles.assistantQuestionIcon}>
        <Icon name={icon} color="#713BA0" size={23} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.assistantQuestionTitle}>{title}</Text>
        <Text style={styles.assistantQuestionSub}>{subtitle}</Text>
      </View>
      <Icon name="chevron-forward" color="#151744" size={20} />
    </Pressable>
  );
}

function AssistantResourceCard({
  icon,
  label,
  background,
  iconColor,
  onPress,
}: {
  icon: string;
  label: string;
  background: string;
  iconColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.assistantResourceCard,
        { backgroundColor: background, opacity: pressed ? 0.75 : 1 },
      ]}
    >
      <View style={[styles.assistantQuickIcon, { width: 42, height: 42 }]}>
        <Icon name={icon} color={iconColor} size={22} />
      </View>
      <Text style={styles.assistantResourceLabel}>{label}</Text>
    </Pressable>
  );
}

export function AssistantScreen() {
  const { state, dispatch } = useCare();
  const n = useNav();
  const [faith, setFaith] = useState(state.faith);
  const scroll = useRef<ScrollView>(null);
  const firstName = state.name.trim().split(/\s+/)[0] || "there";

  const send = (text: string) => {
    const answer = previewReply(text, faith);
    dispatch({
      type: "conversation-turn",
      messages: [
        makeMessage("user", text),
        { ...makeMessage("assistant", answer.text), ...answer },
      ],
    });
  };

  const hasMessages = state.conversation.messages.length > 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#FFFFFF" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={styles.assistantTopbar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => n.goBack()}
          style={({ pressed }) => [
            styles.assistantBack,
            { opacity: pressed ? 0.65 : 1 },
          ]}
        >
          <Icon name="arrow-back" color="#171943" size={22} />
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text style={styles.assistantTopTitle}>EnVizion Assistant</Text>
          <Text style={styles.assistantTopSub}>Your AI caregiver companion</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open guided support"
          onPress={() => n.navigate("Resources")}
          style={({ pressed }) => [
            styles.assistantGuideBadge,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Icon name="book-outline" color="#713BA0" size={18} />
          <Text style={styles.assistantGuideText}>Guided support</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scroll}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 16 }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        onContentSizeChange={() => {
          if (hasMessages) scroll.current?.scrollToEnd({ animated: false });
        }}
      >
        {!hasMessages ? (
          <>
            <View style={styles.assistantHero}>
              <View style={styles.assistantHeroGlowOne} />
              <View style={styles.assistantHeroGlowTwo} />
              <Text style={styles.assistantGreeting}>Hi {firstName} 👋</Text>
              <Text style={styles.assistantHeroTitle}>
                How can I support you today?
              </Text>
              <Text style={styles.assistantHeroBody}>
                Get personalized guidance, practical tools, and faith-based
                support for your caregiving journey.
              </Text>

              <AssistantRobot />

              <View style={styles.assistantHeroPills}>
                <AssistantFeaturePill
                  icon="sparkles"
                  label="Practical advice"
                  tint="#7A3DB0"
                />
                <AssistantFeaturePill
                  icon="book"
                  label="Trusted resources"
                  tint="#4A78D9"
                />
                <AssistantFeaturePill
                  icon="heart"
                  label="Faith-based encouragement"
                  tint="#D75F7E"
                  active={faith}
                  onPress={() => setFaith((value) => !value)}
                />
              </View>
            </View>

            <View style={styles.assistantQuickGrid}>
              <AssistantQuickCard
                icon="document-text-outline"
                label={"Summarize\ninformation"}
                background="#F4EEFF"
                iconColor="#7A3DB0"
                onPress={() => n.navigate("Summary")}
              />
              <AssistantQuickCard
                icon="medkit-outline"
                label={"Medication\nhelp"}
                background="#EEF5FF"
                iconColor="#4E7EE8"
                onPress={() => n.navigate("Medications")}
              />
              <AssistantQuickCard
                icon="calendar-outline"
                label={"Prepare\nfor a visit"}
                background="#EEF9F0"
                iconColor="#25A768"
                onPress={() => n.navigate("Appointments")}
              />
              <AssistantQuickCard
                icon="home-outline"
                label={"Plan transition\nhome"}
                background="#FFF2E8"
                iconColor="#E6845F"
                onPress={() => n.navigate("Transition")}
              />
            </View>

            <View style={styles.assistantSectionHeader}>
              <Text style={styles.assistantSectionTitle}>Popular questions</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => n.navigate("Resources")}
                style={{ flexDirection: "row", alignItems: "center", gap: 2 }}
              >
                <Text style={styles.assistantViewAll}>View all</Text>
                <Icon name="chevron-forward" color="#713BA0" size={15} />
              </Pressable>
            </View>

            <View style={styles.assistantQuestionList}>
              <AssistantQuestion
                icon="medical-outline"
                title="How do I prepare for a doctor’s visit?"
                subtitle="Get a step-by-step checklist"
                onPress={() => send("How do I prepare for a doctor’s visit?")}
              />
              <AssistantQuestion
                icon="medkit-outline"
                title="How can I organize medications?"
                subtitle="Tips, reminders and safety guidelines"
                onPress={() => send("How can I organize medications?")}
              />
              <AssistantQuestion
                icon="home-outline"
                title="What should I prepare before going home?"
                subtitle="Discharge planning and home care tips"
                onPress={() =>
                  send("What should I prepare before going home from the hospital?")
                }
              />
            </View>

            <View style={styles.assistantResourceGrid}>
              <AssistantResourceCard
                icon="chatbubble-outline"
                label="Talk to our team"
                background="#FAF6FF"
                iconColor="#713BA0"
                onPress={() => n.navigate("Handoff")}
              />
              <AssistantResourceCard
                icon="call-outline"
                label="Emergency help"
                background="#FFF2F2"
                iconColor="#D34E67"
                onPress={() => n.navigate("Emergency")}
              />
              <AssistantResourceCard
                icon="book-outline"
                label="Caregiving resources"
                background="#F7F4FF"
                iconColor="#7552B3"
                onPress={() => n.navigate("Resources")}
              />
              <AssistantResourceCard
                icon="people-outline"
                label="Community support"
                background="#EEFAF8"
                iconColor="#2DA88E"
                onPress={() => n.navigate("Handoff")}
              />
            </View>
          </>
        ) : (
          <View style={{ paddingHorizontal: 20, paddingTop: 8, gap: 14 }}>
            <View style={styles.assistantChatIntro}>
              <View style={styles.assistantChatOrb}>
                <Icon name="sparkles" color="#FFFFFF" size={21} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[S.h3, { color: "#171943" }]}>
                  I’m here with you.
                </Text>
                <Text style={[S.small, { marginTop: 2, color: "#777589" }]}>
                  Ask a follow-up or choose another caregiving topic.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Start a new assistant conversation"
                onPress={() => dispatch({ type: "conversation-clear" })}
                style={{ padding: 8 }}
              >
                <Icon name="refresh-outline" color="#713BA0" size={21} />
              </Pressable>
            </View>

            {state.conversation.messages.map((message) => (
              <Bubble key={message.id} message={message} />
            ))}
          </View>
        )}
      </ScrollView>

      <Composer onSend={send} />
    </KeyboardAvoidingView>
  );
}

export function HandoffScreen() {
  const { state } = useCare();
  const n = useNav();
  const [topic, setTopic] = useState("Navigating care");
  const [context, setContext] = useState("");
  const [include, setInclude] = useState(false);
  const [channel, setChannel] =
    useState<"In-app inbox" | "WhatsApp" | "Email">("In-app inbox");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  async function submit() {
    setMessage("");
    setSubmitting(true);
    try {
      await createSupportRequest({
        topic,
        context,
        preferredChannel: channel,
        includeAssistantContext: include && state.conversation.messages.length > 0,
      });
      n.replace("TeamConversation");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not send your request. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Page>
      <Heading
        eyebrow="SUPPORT FROM A PERSON"
        title="Let’s bring in the team."
        body="Some questions deserve a conversation. Tell the EnVizion Life team what you would like help with."
      />
      <Card style={{ backgroundColor: C.lavender }}>
        <Text style={S.h3}>Your request is securely saved</Text>
        <Txt>
          Requests are stored with your account so the support team can review
          them when the staff workspace is connected.
        </Txt>
      </Card>

      <Section title="What’s on your mind?" />
      <View style={styles.chips}>
        {[
          "Navigating care",
          "Coaching support",
          "Using the toolkit",
          "Something else",
        ].map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: topic === value }}
            onPress={() => setTopic(value)}
            style={[
              styles.chip,
              topic === value && {
                backgroundColor: C.lavender,
                borderColor: C.purple,
              },
            ]}
          >
            <Text style={S.body}>{value}</Text>
          </Pressable>
        ))}
      </View>

      <Field
        label="What would you like the team to know?"
        value={context}
        onChange={(value) => setContext(value.slice(0, 1200))}
        multiline
      />
      <Text style={S.small}>{context.length}/1200</Text>

      <Section title="Preferred reply channel" />
      <View style={styles.chips}>
        {(["In-app inbox", "WhatsApp", "Email"] as const).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: channel === value }}
            onPress={() => setChannel(value)}
            style={[
              styles.chip,
              channel === value && {
                backgroundColor: C.lavender,
                borderColor: C.purple,
              },
            ]}
          >
            <Text style={S.body}>{value}</Text>
          </Pressable>
        ))}
      </View>

      <Card>
        <View style={S.between}>
          <Text style={[S.h3, { flex: 1 }]}>Include assistant context</Text>
          <Switch
            accessibilityLabel="Include assistant context with support request"
            value={include}
            onValueChange={setInclude}
            trackColor={{ true: C.purple }}
          />
        </View>
        <Txt style={S.small}>
          This records whether you want the EnVizion team to consider the
          assistant conversation when reviewing your request. Health tracker
          entries are not automatically attached.
        </Txt>
      </Card>

      {Boolean(message) && (
        <Text accessibilityRole="alert" style={[S.small, { color: C.rose }]}>
          {message}
        </Text>
      )}

      <Button
        title={submitting ? "Sending request…" : "Send support request"}
        icon="arrow-forward-outline"
        disabled={!context.trim() || submitting}
        onPress={submit}
      />

      <Button
        title="View my latest request"
        secondary
        onPress={() => n.navigate("TeamConversation")}
      />

      <Button
        title="Prepare a caregiver handoff packet"
        secondary
        icon="reader-outline"
        onPress={() => n.navigate("CarePacket")}
      />

      <Safety onPress={() => n.navigate("Emergency")} />
      <Txt style={S.small}>
        Support messaging is not an emergency service. For urgent medical help,
        use your local emergency services.
      </Txt>
    </Page>
  );
}

export function TeamConversationScreen() {
  const n = useNav();
  const [request, setRequest] = useState<SupportRequestRecord | null>(null);
  const [messages, setMessages] = useState<SupportMessageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [composer, setComposer] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const scroll = useRef<ScrollView>(null);

  async function refresh() {
    try {
      const result = await loadLatestSupportRequest();
      setRequest(result.request);
      setMessages(result.messages);
    } catch {
      setMessage("We could not load your support request.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function send() {
    if (!request || !composer.trim()) return;
    setSending(true);
    setMessage("");
    try {
      await sendSupportMessage(request.id, composer);
      setComposer("");
      await refresh();
    } catch {
      setMessage("We could not send your message. Please try again.");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <Page>
        <Heading title="Your support request" />
        <Txt>Loading your conversation…</Txt>
      </Page>
    );
  }

  if (!request) {
    return (
      <Page>
        <Heading
          title="Your support conversations"
          body="Send a request when you would like help from the EnVizion Life team."
        />
        <Button title="Talk to our team" onPress={() => n.navigate("Handoff")} />
      </Page>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.paper }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={styles.header}>
        <Text style={S.h3}>EnVizion Life support</Text>
        <Badge
          text={
            request.status === "closed"
              ? "Closed"
              : request.status === "responded"
                ? "Response available"
                : request.status === "in_review"
                  ? "In review"
                  : "Submitted"
          }
        />
        <Text style={S.small}>
          Preferred channel: {request.preferred_channel}
        </Text>
      </View>

      <ScrollView
        ref={scroll}
        contentContainerStyle={{ padding: 20, gap: 16 }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        onContentSizeChange={() => {
          if (messages.length) scroll.current?.scrollToEnd({ animated: false });
        }}
      >
        <Card>
          <Text style={S.eyebrow}>{request.topic}</Text>
          <Text style={S.body}>{request.context}</Text>
          <Text style={S.small}>
            Sent {new Date(request.created_at).toLocaleString()}
          </Text>
        </Card>

        {messages.length ? (
          messages.map((item) => (
            <View
              key={item.id}
              style={[
                styles.bubble,
                item.sender_type === "caregiver"
                  ? styles.userBubble
                  : styles.assistantBubble,
              ]}
            >
              <Text
                style={[
                  S.body,
                  {
                    color:
                      item.sender_type === "caregiver" ? C.white : C.ink,
                  },
                ]}
              >
                {item.body}
              </Text>
              <Text
                style={[
                  S.small,
                  {
                    color:
                      item.sender_type === "caregiver" ? "#DDCAE5" : C.muted,
                  },
                ]}
              >
                {item.sender_type === "caregiver" ? "You" : "EnVizion team"} ·{" "}
                {new Date(item.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          ))
        ) : (
          <Card>
            <Icon name="time-outline" />
            <Text style={S.h3}>Your request has been submitted.</Text>
            <Txt>
              It is stored securely with your account. Team responses will
              appear here once the staff workspace is connected.
            </Txt>
          </Card>
        )}

        {Boolean(message) && (
          <Text accessibilityRole="alert" style={[S.small, { color: C.rose }]}>
            {message}
          </Text>
        )}
      </ScrollView>

      {request.status !== "closed" && (
        <View style={styles.composer}>
          <View style={styles.inputRow}>
            <TextInput
              value={composer}
              onChangeText={(value) => setComposer(value.slice(0, 1200))}
              accessibilityLabel="Message EnVizion support"
              placeholder="Add a follow-up message…"
              placeholderTextColor={C.muted}
              multiline
              editable={!sending}
              style={[
                S.input,
                {
                  flex: 1,
                  minHeight: 50,
                  maxHeight: 130,
                  textAlignVertical: "top",
                  padding: 13,
                },
              ]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send follow-up message"
              disabled={sending || !composer.trim()}
              onPress={() => void send()}
              style={({ pressed }) => ({
                width: 50,
                height: 50,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 15,
                backgroundColor: C.deep,
                opacity: sending || !composer.trim() ? 0.4 : pressed ? 0.7 : 1,
              })}
            >
              <Icon name="arrow-up" color={C.white} />
            </Pressable>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
