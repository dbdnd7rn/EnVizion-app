import React, { useRef, useState } from "react";
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
            ? "STAFF REPLY · PREVIEW"
            : "ENVIZION ASSISTANT · SCRIPTED PREVIEW"}
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
      <Text style={S.small}>Sample information only · {text.length}/1200</Text>
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
          <Badge text="Preview" />
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
  const { state, dispatch } = useCare();
  const n = useNav();
  const [topic, setTopic] = useState("Navigating care");
  const [context, setContext] = useState("");
  const [include, setInclude] = useState(false);
  const [channel, setChannel] =
    useState<SupportRequest["channel"]>("In-app inbox");
  const active = state.conversation.request?.status === "preview-open";
  return (
    <Page>
      <Heading
        eyebrow="SUPPORT FROM A PERSON"
        title="Let’s bring in the team."
        body="Some questions deserve a conversation. Tell the team what you would like help with."
      />
      <Card style={{ backgroundColor: C.lavender }}>
        <Text style={S.h3}>Review the handoff before sharing</Text>
        <Txt>
          This preview saves a request on this device session only. No staff are
          notified and no WhatsApp message or email is sent.
        </Txt>
      </Card>
      {active ? (
        <Row
          title="View your open preview conversation"
          subtitle="Continue the request you already prepared"
          icon="chatbubbles-outline"
          onPress={() => n.navigate("TeamConversation")}
        />
      ) : (
        <>
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
          <Text style={S.small}>
            {context.length}/1200 · Use sample details in this preview.
          </Text>
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
          <Txt style={S.small}>
            {channel === "In-app inbox"
              ? "Preview replies can be entered from the staff workspace. No live staff connection yet."
              : `${channel} delivery is not connected. Your preference is saved with the preview request; no contact details are collected here.`}
          </Txt>
          <Card>
            <View style={S.between}>
              <Text style={[S.h3, { flex: 1 }]}>
                Include assistant conversation
              </Text>
              <Switch
                accessibilityLabel="Include assistant conversation with support request"
                value={include}
                onValueChange={setInclude}
                trackColor={{ true: C.purple }}
              />
            </View>
            <Txt style={S.small}>
              Optional. Tracker readings, medication logs, and reflections are
              never attached by this screen.
            </Txt>
            {include && (
              <View style={{ gap: 10 }}>
                <Text style={S.eyebrow}>EXACT CONVERSATION TO INCLUDE</Text>
                {state.conversation.messages.length ? (
                  state.conversation.messages.map((m) => (
                    <Text key={m.id} style={S.small}>
                      {m.role === "user" ? "You" : "Assistant"}: {m.text}
                    </Text>
                  ))
                ) : (
                  <Txt>No assistant messages to include.</Txt>
                )}
              </View>
            )}
          </Card>
          <Button
            title="Save preview request"
            icon="arrow-forward-outline"
            disabled={!context.trim()}
            onPress={() => {
              dispatch({
                type: "support-request",
                request: {
                  id: `EV-${Date.now()}`,
                  topic,
                  context: context.trim(),
                  channel,
                  transcript: include ? state.conversation.messages : [],
                  thread: [],
                  status: "preview-open",
                },
              });
              n.replace("TeamConversation");
            }}
          />
        </>
      )}
      <Safety onPress={() => n.navigate("Emergency")} />
      <Txt style={S.small}>
        Support chat is not an emergency service. Staff availability and
        response times will be shown when live support is connected.
      </Txt>
    </Page>
  );
}

export function TeamConversationScreen() {
  const { state, dispatch } = useCare();
  const n = useNav();
  const request = state.conversation.request;
  const scroll = useRef<ScrollView>(null);
  if (!request)
    return (
      <Page>
        <Heading
          title="Your support conversations"
          body="Prepare a request to start a conversation."
        />
        <Button
          title="Talk to our team"
          onPress={() => n.navigate("Handoff")}
        />
      </Page>
    );
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.paper }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={styles.header}>
        <Text style={S.h3}>EnVizion support team</Text>
        <Badge
          text={
            request.status === "preview-open"
              ? "Local preview · not delivered"
              : "Preview conversation closed"
          }
        />
        <Text style={S.small}>
          Preferred channel: {request.channel} · No live delivery
        </Text>
      </View>
      <ScrollView
        ref={scroll}
        contentContainerStyle={{ padding: 20, gap: 16 }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        onContentSizeChange={() => {
          if (request.thread.length)
            scroll.current?.scrollToEnd({ animated: false });
        }}
      >
        <Card>
          <Text style={S.eyebrow}>{request.topic}</Text>
          <Text style={S.body}>{request.context}</Text>
          <Text style={S.small}>
            {request.transcript.length
              ? `${request.transcript.length} assistant conversation messages included`
              : "Assistant conversation not included"}
          </Text>
        </Card>
        {request.thread.length ? (
          request.thread.map((message) => (
            <Bubble key={message.id} message={message} />
          ))
        ) : (
          <Card>
            <Icon name="chatbubble-ellipses-outline" />
            <Text style={S.h3}>Your request is ready to review.</Text>
            <Txt>
              No one has received this preview request. To test both sides, open
              Staff inbox preview from your profile and write a sample reply.
            </Txt>
          </Card>
        )}
        {request.status === "preview-resolved" && (
          <Button
            title="Prepare another request"
            onPress={() => n.navigate("Handoff")}
          />
        )}
      </ScrollView>
      <Composer
        placeholder="Write a follow-up…"
        disabled={request.status !== "preview-open"}
        onSend={(text) =>
          dispatch({
            type: "support-message",
            requestId: request.id,
            message: makeMessage("user", text),
          })
        }
      />
    </KeyboardAvoidingView>
  );
}

export function StaffInboxScreen() {
  const { state, dispatch } = useCare();
  const n = useNav();
  const request = state.conversation.request;
  const [reply, setReply] = useState("");
  const [status, setStatus] = useState("");
  return (
    <Page>
      <Heading
        eyebrow="STAFF WORKSPACE · PREVIEW"
        title="Every conversation matters."
        body="Review context and respond from one shared inbox."
      />
      <Card style={{ backgroundColor: C.deep }}>
        <Text style={[S.h3, { color: C.white }]}>Demonstration workspace</Text>
        <Txt style={{ color: "#E4D7EA" }}>
          You are testing the staff view with local sample data. This is not
          staff authentication or a live inbox. WhatsApp and email delivery are
          not connected.
        </Txt>
      </Card>
      {!request ? (
        <Card>
          <Icon name="file-tray-outline" />
          <Text style={S.h3}>No preview requests yet</Text>
          <Txt>
            Prepare a request from the caregiver assistant to see it here.
          </Txt>
          <Button
            title="Open caregiver assistant"
            secondary
            onPress={() => n.navigate("Assistant")}
          />
        </Card>
      ) : (
        <>
          <View style={S.between}>
            <Text style={S.h2}>{request.topic}</Text>
            <Badge
              text={
                request.status === "preview-open"
                  ? "Open preview"
                  : "Closed preview"
              }
            />
          </View>
          <Card>
            <Text style={S.eyebrow}>REQUEST DETAILS</Text>
            <Text style={S.body}>{request.context}</Text>
            <Txt style={S.small}>Preferred channel: {request.channel}</Txt>
            <Txt style={S.small}>Reference: {request.id}</Txt>
          </Card>
          <Section title="Shared context" />
          <Card>
            {request.transcript.length ? (
              request.transcript.map((m) => (
                <Txt key={m.id}>
                  {m.role === "user" ? "Caregiver" : "Assistant"}: {m.text}
                </Txt>
              ))
            ) : (
              <Txt>The caregiver did not attach an assistant conversation.</Txt>
            )}
          </Card>
          <Section title="Conversation" />
          {request.thread.map((message) => (
            <Bubble key={message.id} message={message} />
          ))}
          {request.status === "preview-open" && (
            <Card>
              <Field
                label="Staff preview reply"
                value={reply}
                onChange={(value) => setReply(value.slice(0, 1200))}
                multiline
              />
              <Button
                title="Add sample staff reply"
                disabled={!reply.trim()}
                onPress={() => {
                  dispatch({
                    type: "support-message",
                    requestId: request.id,
                    message: makeMessage("staff", reply),
                  });
                  setReply("");
                  setStatus(
                    "Sample reply added to the caregiver view. Nothing was sent externally.",
                  );
                }}
              />
              <Button
                title="Close preview conversation"
                secondary
                onPress={() =>
                  dispatch({ type: "support-resolve", requestId: request.id })
                }
              />
            </Card>
          )}
          {Boolean(status) && (
            <Text accessibilityRole="alert" style={S.body}>
              {status}
            </Text>
          )}
          <Button
            title="View caregiver conversation"
            secondary
            onPress={() => n.navigate("TeamConversation")}
          />
        </>
      )}
    </Page>
  );
}
