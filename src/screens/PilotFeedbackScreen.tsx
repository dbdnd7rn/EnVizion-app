import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
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
} from "../ui";

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

  useEffect(() => {
    let active = true;
    loadPilotConsentState()
      .then((next) => {
        if (active) setConsent(next);
      })
      .catch(() => {
        if (active) {
          setConsent({ enrolled: false, status: null, outstanding: [] });
        }
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
        title="Tell us what the real caregiver experience feels like."
        body="Pilot feedback is kept separate from clinical care records. Bugs go to technical diagnostics; experience feedback and suggestions go to the support triage queue."
      />

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
                opacity: eligible ? 1 : 0.55,
              },
            ]}
          >
            <View style={S.row}>
              <Icon
                name={item.icon}
                color={selected ? C.purple : C.muted}
                size={24}
              />
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

      <Section title="What happened?" />
      <Field
        label="Short summary"
        value={summary}
        onChange={setSummary}
      />
      <Field
        label={
          category === "bug"
            ? "What did you do, and what happened instead?"
            : "Tell us more"
        }
        value={detail}
        onChange={setDetail}
        multiline
      />

      <Button
        title={submitting ? "Sending…" : "Send pilot feedback"}
        icon="send-outline"
        disabled={
          !eligible ||
          submitting ||
          !summary.trim() ||
          !detail.trim()
        }
        onPress={() => void submit()}
      />

      {Boolean(message) && (
        <Card>
          <Text accessibilityRole="alert" style={S.body}>
            {message}
          </Text>
        </Card>
      )}

      <Txt style={S.small}>
        Do not use pilot feedback for emergencies or urgent clinical concerns.
        Feedback submissions may include technical/app context but should not
        contain unnecessary medical details.
      </Txt>
    </Page>
  );
}
