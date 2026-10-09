import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import {
  loadPilotConsentState,
  type PilotConsentState,
} from "../pilot";
import {
  submitPilotFeedback,
  type PilotFeedbackCategory,
} from "../pilotFeedback";
import { useCare } from "../store";
import {
  Button,
  C,
  Card,
  Field,
  Heading,
  Icon,
  Page,
  S,
  Section,
  Txt,
} from "./ProfileLinkedUI";

const categories: Array<{
  id: PilotFeedbackCategory;
  title: string;
  detail: string;
  icon: string;
}> = [
  {
    id: "bug",
    title: "Report a bug",
    detail: "Something broke, behaved unexpectedly, or looked wrong.",
    icon: "bug-outline",
  },
  {
    id: "experience",
    title: "Share experience",
    detail: "Tell EnVizion what felt clear, confusing, useful, or difficult.",
    icon: "chatbubble-ellipses-outline",
  },
  {
    id: "suggestion",
    title: "Suggest an improvement",
    detail: "Recommend a change that would make the caregiver experience better.",
    icon: "bulb-outline",
  },
];

export function PilotFeedbackScreen() {
  const { state } = useCare();
  const [consent, setConsent] = useState<PilotConsentState | null>(null);
  const [category, setCategory] =
    useState<PilotFeedbackCategory>("experience");
  const [summary, setSummary] = useState("");
  const [detail, setDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [consentError, setConsentError] = useState(false);

  useEffect(() => {
    let active = true;
    loadPilotConsentState()
      .then((next) => {
        if (active) { setConsent(next); setConsentError(false); }
      })
      .catch(() => {
        if (active) { setConsentError(true); }
      });
    return () => {
      active = false;
    };
  }, []);

  const eligible =
    consent?.enrolled === true &&
    consent.status !== "exited";

  async function submit() {
    if (!eligible || submitting) return;
    setSubmitting(true);
    setMessage("");
    try {
      await submitPilotFeedback({
        category,
        summary,
        detail,
        careRecipientId: state.careRecipientId,
      });
      setSummary("");
      setDetail("");
      setMessage(
        category === "bug"
          ? "Bug report sent to the pilot technical queue."
          : "Pilot feedback sent to EnVizion Life.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Pilot feedback could not be sent.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Page>
      <Heading
        eyebrow="PILOT FEEDBACK"
        title="Your voice makes care better."
        body="Share a bug, your experience or a thoughtful improvement. We're listening."
      />

      {!consent && !consentError && (
        <Card style={{ backgroundColor: C.lavender }}>
          <ActivityIndicator color={C.purple} />
          <Txt>Checking pilot feedback access…</Txt>
        </Card>
      )}

      {consentError && (
        <Card style={{ backgroundColor: "#FFF3F5", borderColor: "#F0D4DB" }}>
          <Icon name="cloud-offline-outline" color={C.rose} size={25}/>
          <Text style={S.h3}>Feedback access could not be checked.</Text>
          <Txt style={S.small}>Reopen this page when your connection returns. Your draft stays here while you are on this page.</Txt>
        </Card>
      )}

      {consent && !eligible && (
        <Card style={{ backgroundColor: "#FFF9F2" }}>
          <Icon name="lock-closed-outline" size={26} />
          <Text style={S.h3}>Pilot feedback is available to enrolled testers.</Text>
          <Txt style={S.small}>
            This account is not currently enrolled in an active pilot journey.
          </Txt>
        </Card>
      )}

      <Section title="Feedback type" />
      {categories.map((item) => {
        const selected = item.id === category;
        return (
          <Pressable
            key={item.id}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled: !eligible }}
            disabled={!eligible || submitting}
            onPress={() => setCategory(item.id)}
            style={[
              S.card,
              {
                borderColor: selected ? C.purple : C.line,
                backgroundColor: selected ? "#F4E9FA" : "#FFFFFF",
                opacity: eligible ? 1 : 0.55,
                minHeight: 85,
                justifyContent: "center",
              },
            ]}
          >
            <View style={S.row}>
              <View style={{
                width: 46, height: 46, borderRadius: 16,
                backgroundColor: selected ? "#E8D4F5" : "#F3EAF9",
                alignItems: "center", justifyContent: "center",
              }}>
                <Icon name={item.icon} color={C.purple} size={23} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={S.h3}>{item.title}</Text>
                <Txt style={S.small}>{item.detail}</Txt>
              </View>
              <Icon
                name={selected ? "radio-button-on" : "radio-button-off"}
                color={selected ? C.purple : C.muted}
                size={20}
              />
            </View>
          </Pressable>
        );
      })}

      <Section title="Tell us more" />
      <Card style={{ backgroundColor: "#FFFFFFF0", gap: 16 }}>
        <Field
          label="Short summary"
          value={summary}
          onChange={setSummary}
        />
        <Field
          label={category === "bug"
            ? "What did you do, and what happened instead?"
            : "Tell us more"}
          value={detail}
          onChange={setDetail}
          multiline
        />
        <Button
          title={submitting ? "Sending…" : "Send pilot feedback"}
          icon="send-outline"
          disabled={!eligible || submitting || !summary.trim() || !detail.trim()}
          onPress={() => void submit()}
        />
      </Card>

      {Boolean(message) && (
        <Card>
          <Text accessibilityRole="alert" style={S.body}>
            {message}
          </Text>
        </Card>
      )}

      <Card style={{ backgroundColor: "#FFF2F4", borderColor: "#F1D6DF" }}>
        <View style={S.row}>
          <Icon name="alert-circle-outline" color={C.rose} size={23} />
          <Text style={[S.h3, { flex: 1, color: C.rose, fontSize: 14 }]}>
            For feedback, not emergencies
          </Text>
        </View>
        <Txt style={S.small}>
          Do not use pilot feedback for emergencies or urgent clinical concerns.
          Feedback submissions may include technical/app context but should not
          contain unnecessary medical details.
        </Txt>
      </Card>
    </Page>
  );
}
