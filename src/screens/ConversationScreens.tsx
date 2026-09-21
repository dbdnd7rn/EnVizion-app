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
  placeholder = "Ask a basic caregiving question…",
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  return (
    <View style={styles.composer}>
      <View style={styles.inputRow}>
        <TextInput
          value={text}
          onChangeText={setText}
          accessibilityLabel={label}
          placeholder={placeholder}
          placeholderTextColor={C.muted}
          multiline
          maxLength={1200}
          editable={!disabled}
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
          accessibilityLabel="Send message"
          disabled={disabled || !text.trim()}
          onPress={() => {
            const value = text.trim();
            if (!value || disabled) return;
            onSend(value);
            setText("");
          }}
          style={({ pressed }) => ({
            width: 50,
            height: 50,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 15,
            backgroundColor: C.deep,
            opacity: disabled || !text.trim() ? 0.4 : pressed ? 0.7 : 1,
          })}
        >
          <Icon name="arrow-up" color={C.white} />
        </Pressable>
      </View>
      <Text style={S.small}>Educational support · {text.length}/1200</Text>
    </View>
  );
}

export function AssistantScreen() {
  const { state, dispatch } = useCare();
  const n = useNav();
  const [faith, setFaith] = useState(false);
  const scroll = useRef<ScrollView>(null);
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
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.paper }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={styles.header}>
        <View style={S.row}>
          <View style={styles.avatar}>
            <Icon name="chatbubbles-outline" color={C.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={S.h3}>EnVizion Assistant</Text>
            <Text style={S.small}>A starting point for your questions</Text>
          </View>
          <Badge text="Guided support" />
        </View>
        <View style={S.between}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Talk to our team"
            onPress={() => n.navigate("Handoff")}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <Text style={[S.h3, { color: C.purple, fontSize: 13 }]}>
              Talk to our team →
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Emergency help"
            onPress={() => n.navigate("Emergency")}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <Text style={[S.h3, { color: C.rose, fontSize: 13 }]}>
              Emergency help
            </Text>
          </Pressable>
        </View>
      </View>
      <ScrollView
        ref={scroll}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, gap: 18 }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        onContentSizeChange={() => {
          if (state.conversation.messages.length)
            scroll.current?.scrollToEnd({ animated: false });
        }}
      >
        {state.conversation.messages.length === 0 ? (
          <Fade>
            <View style={{ paddingVertical: 10, gap: 12 }}>
              <Text style={S.eyebrow}>A LITTLE GUIDANCE, WHEN YOU NEED IT</Text>
              <Text
                style={[
                  S.title,
                  { fontFamily: "DMSans_600SemiBold", fontSize: 29 },
                ]}
              >
                What would make{`\n`}today a little easier?
              </Text>
              <Txt>
                Find the right tool, prepare a question, or start a conversation
                with the team.
              </Txt>
            </View>
            <View style={styles.chips}>
              {starters.map((starter) => (
                <Pressable
                  key={starter}
                  accessibilityRole="button"
                  onPress={() => send(starter)}
                  style={styles.chip}
                >
                  <Text style={[S.body, { color: C.ink }]}>{starter}</Text>
                </Pressable>
              ))}
            </View>
          </Fade>
        ) : (
          state.conversation.messages.map((message) => (
            <Bubble key={message.id} message={message} />
          ))
        )}
        <View style={[S.row, { alignItems: "flex-start" }]}>
          <Icon name="information-circle-outline" size={18} color={C.muted} />
          <Txt style={[S.small, { flex: 1 }]}>
            Scripted demonstration. Live AI is not connected. Replies cannot
            assess symptoms, diagnose, or prescribe. For a possible emergency,
            call your local emergency number.
          </Txt>
        </View>
      </ScrollView>
      <View style={[S.between, { paddingHorizontal: 20, paddingVertical: 6 }]}>
        <Text style={[S.small, { flex: 1 }]}>
          Include spiritual encouragement
        </Text>
        <Switch
          accessibilityLabel="Include spiritual encouragement in assistant replies"
          value={faith}
          onValueChange={setFaith}
          trackColor={{ true: C.purple }}
        />
      </View>
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
