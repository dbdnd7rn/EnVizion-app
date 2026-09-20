import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useAuth } from "./auth";
import {
  acceptProgramDocument,
  loadPilotConsentState,
  type PilotConsentState,
  type ProgramDocument,
} from "./pilot";
import { Brand, Button, C, Card, Heading, Page, S, Txt } from "./ui";

function actionLabel(document: ProgramDocument) {
  if (document.documentType === "pilot_consent") {
    return "I consent to participate";
  }
  if (document.documentType === "terms_of_use") {
    return "Accept and continue";
  }
  return "Acknowledge and continue";
}

export function PilotConsentGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const { signOut } = useAuth();
  const [state, setState] = useState<PilotConsentState | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      setState(await loadPilotConsentState());
    } catch (error) {
      setState(null);
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not verify the current pilot participation documents.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading) {
    return (
      <Page>
        <Brand />
        <View
          style={{
            minHeight: 360,
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
          }}
        >
          <ActivityIndicator color={C.purple} />
          <Txt>Checking pilot participation documents…</Txt>
        </View>
      </Page>
    );
  }

  if (!state) {
    return (
      <Page>
        <Brand />
        <Heading
          eyebrow="PILOT PARTICIPATION"
          title="We could not verify your current consent status."
          body="For privacy, EnVizion Life will not open the pilot workspace until this check succeeds."
        />
        <Card style={{ backgroundColor: C.redBg }}>
          <Text accessibilityRole="alert" style={[S.body, { color: C.rose }]}>
            {message || "Please check your connection and try again."}
          </Text>
        </Card>
        <Button title="Try again" onPress={() => void refresh()} />
        <Button title="Sign out" secondary onPress={() => void signOut()} />
      </Page>
    );
  }

  const document = state.outstanding[0];
  if (!document) return <>{children}</>;

  async function accept() {
    setAccepting(true);
    setMessage("");
    try {
      await acceptProgramDocument(document.id);
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not record your response.",
      );
    } finally {
      setAccepting(false);
    }
  }

  return (
    <Page>
      <Brand />
      <Heading
        eyebrow="PILOT PARTICIPATION"
        title={document.title}
        body={`Version ${document.version} · Review this current EnVizion Life document before continuing.`}
      />

      <Card style={{ backgroundColor: C.lavender }}>
        <Text style={S.eyebrow}>
          {document.documentType.replaceAll("_", " ").toUpperCase()}
        </Text>
        {document.effectiveAt && (
          <Txt style={S.small}>
            Effective {new Date(document.effectiveAt).toLocaleDateString()}
          </Txt>
        )}
      </Card>

      <Card>
        <Text
          selectable
          style={[S.body, { lineHeight: 24 }]}
        >
          {document.body}
        </Text>
      </Card>

      {Boolean(message) && (
        <Text accessibilityRole="alert" style={[S.body, { color: C.rose }]}>
          {message}
        </Text>
      )}

      <Button
        title={accepting ? "Recording your response…" : actionLabel(document)}
        disabled={accepting}
        icon="checkmark-circle-outline"
        onPress={() => void accept()}
      />
      <Button
        title="Sign out"
        secondary
        disabled={accepting}
        onPress={() => void signOut()}
      />

      <Txt style={S.small}>
        Your acceptance is recorded with the exact published document version.
        If EnVizion Life publishes a new required version later, you will be
        asked to review that version separately.
      </Txt>
    </Page>
  );
}
