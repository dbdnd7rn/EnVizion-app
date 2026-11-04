import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Text, View } from "react-native";
import { useAuth } from "./auth";
import {
  acceptProgramDocument,
  loadPilotConsentState,
  type PilotConsentState,
  type ProgramDocument,
} from "./pilot";
import { Brand, Button, C, Card, Heading, Page, S, Txt } from "./ui";
import { pilotConsentMayProceed, pilotDocumentLabels } from "./pilotConsentSafety";

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
  const requestSerialRef = useRef(0);

  const refresh = useCallback(async () => {
    const serial = ++requestSerialRef.current;
    setLoading(true);
    setMessage("");
    try {
      const next = await loadPilotConsentState();
      if (serial === requestSerialRef.current) setState(next);
    } catch (error) {
      if (serial !== requestSerialRef.current) return;
      setState(null);
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not verify the current pilot participation documents.",
      );
    } finally {
      if (serial === requestSerialRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    // A new required document may have been published while the app was away.
    // Recheck current consent before returning an existing pilot to clinical data.
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") void refresh();
    });
    return () => {
      subscription.remove();
      requestSerialRef.current += 1;
    };
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
  if (pilotConsentMayProceed(state)) return <>{children}</>;
  if (!document && state.missingRequiredTypes.length > 0) {
    return (
      <Page>
        <Brand />
        <Heading
          eyebrow="PILOT PARTICIPATION"
          title="Your pilot documents are not ready yet."
          body="The administrator must publish every required participation document before your pilot workspace can open. No consent has been assumed."
        />
        <Card style={{ backgroundColor: C.redBg }}>
          <Text accessibilityRole="alert" style={S.body}>
            Required documents still awaiting publication:
          </Text>
          {state.missingRequiredTypes.map((type) => (
            <Txt key={type} style={S.small}>• {pilotDocumentLabels[type]}</Txt>
          ))}
        </Card>
        <Button title="Check again" onPress={() => void refresh()} />
        <Button title="Sign out" secondary onPress={() => void signOut()} />
        <Txt style={S.small}>
          Contact your EnVizion Life pilot coordinator. Your care records have not been changed.
        </Txt>
      </Page>
    );
  }
  // A required document can be reviewed and accepted even when another
  // required document is pending publication; the gate remains closed until
  // every current version is available and accepted.
  if (!document) return (
    <Page>
      <Brand />
      <Heading eyebrow="PILOT PARTICIPATION" title="Consent verification is incomplete." />
      <Button title="Check again" onPress={() => void refresh()} />
      <Button title="Sign out" secondary onPress={() => void signOut()} />
    </Page>
  );

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
