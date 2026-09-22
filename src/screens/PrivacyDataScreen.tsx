import React, { useState } from "react";
import { Text, TextInput, View } from "react-native";
import {
  deleteCareRecipientData,
  deleteOwnAccount,
  deliverJsonExport,
  exportAccountData,
  exportCareRecipientData,
} from "../accountData";
import { useAuth } from "../auth";
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
import { useNav } from "./MainScreens";

function safeFilename(value: string) {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "care-profile";
}

export function PrivacyDataScreen() {
  const n = useNav();
  const { user, requestPasswordReset } = useAuth();
  const { state, refresh } = useCare();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [careConfirmation, setCareConfirmation] = useState("");
  const [deleteWord, setDeleteWord] = useState("");
  const [deleteEmail, setDeleteEmail] = useState("");
  const [deletePassword, setDeletePassword] = useState("");

  const isOwner = state.accessRole === "owner";
  const hasCareProfile = Boolean(state.careRecipientId);
  const accountEmail = user?.email ?? "";

  async function run(
    key: string,
    task: () => Promise<void>,
    success?: string,
  ) {
    setBusy(key);
    setMessage("");
    try {
      await task();
      if (success) setMessage(success);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not complete that request.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <Page>
      <Heading
        eyebrow="ACCOUNT, PRIVACY & DATA"
        title="You stay in control of your EnVizion Life data."
        body="Review your account, export information you are authorized to access, and manage destructive actions carefully."
      />

      {Boolean(message) && (
        <Card style={{ backgroundColor: C.white }}>
          <Text
            accessibilityRole="alert"
            style={[
              S.body,
              {
                color: message.toLowerCase().includes("sent")
                  ? C.green
                  : C.ink,
              },
            ]}
          >
            {message}
          </Text>
        </Card>
      )}

      <Section title="Account security" />
      <Card>
        <Text style={S.h3}>Signed-in account</Text>
        <Txt>{accountEmail || "Signed in"}</Txt>
        <Txt style={S.small}>
          Password changes are completed through a secure recovery link and
          sign you out when finished.
        </Txt>
        <Button
          title={busy === "password" ? "Sending link…" : "Send password reset link"}
          secondary
          disabled={busy !== null || !accountEmail}
          onPress={() =>
            void run(
              "password",
              async () => {
                const error = await requestPasswordReset(accountEmail);
                if (error) throw new Error(error);
              },
              "If this account can receive recovery email, a password-reset link has been sent.",
            )
          }
        />
      </Card>

      <Section title="Download your data" />
      <Card>
        <Icon name="download-outline" size={28} />
        <Text style={S.h3}>Account data export</Text>
        <Txt>
          Download the account information tied to your sign-in, including
          preferences, saved resources, support requests, care memberships and
          the care profiles you own.
        </Txt>
        <Button
          title={busy === "account-export" ? "Preparing export…" : "Download account data"}
          disabled={busy !== null}
          onPress={() =>
            void run("account-export", async () => {
              const data = await exportAccountData();
              await deliverJsonExport("envizion-life-account-data.json", data);
            })
          }
        />
      </Card>

      <Card>
        <Icon name="document-text-outline" size={28} />
        <Text style={S.h3}>Active care profile export</Text>
        <Txt>
          {hasCareProfile
            ? `${state.careRecipientName || "This care profile"} · ${isOwner ? "Owner" : "Shared"} access`
            : "No active care profile"}
        </Txt>
        <Txt style={S.small}>
          Care-profile exports are owner-only so a collaborator cannot create a
          portable copy of another family’s complete care record. The export
          includes Care Vault metadata, care contacts, communication history,
          shared care tasks and completion history, caregiver shift handoffs,
          and packet workflow history, but never permanent public file links.
        </Txt>
        <Button
          title={busy === "care-export" ? "Preparing care export…" : "Download active care profile"}
          secondary
          disabled={busy !== null || !hasCareProfile || !isOwner}
          onPress={() =>
            void run("care-export", async () => {
              if (!state.careRecipientId) return;
              const data = await exportCareRecipientData(state.careRecipientId);
              await deliverJsonExport(
                `envizion-life-${safeFilename(state.careRecipientName)}.json`,
                data,
              );
            })
          }
        />
      </Card>

      <Section title="Sharing & consent" />
      <Card>
        <Text style={S.h3}>Who can access this care profile?</Text>
        <Txt>
          Your current role is{" "}
          {state.accessRole === "owner"
            ? "Owner"
            : state.accessRole === "caregiver"
              ? "Caregiver"
              : "Viewer"}.
        </Txt>
        <Txt style={S.small}>
          Care sharing is controlled per care profile. Owners can invite,
          change roles, revoke access and review the sharing history.
        </Txt>
        <Button
          title="Review care team & sharing"
          secondary
          icon="people-outline"
          disabled={!hasCareProfile}
          onPress={() => n.navigate("CareTeam")}
        />
      </Card>

      <Section title="Delete a care profile" />
      <Card style={{ borderColor: "#E7C3C7" }}>
        <Text style={[S.h3, { color: C.rose }]}>Permanent care-profile deletion</Text>
        <Txt>
          This permanently removes the owned care profile and its care
          observations, medications, dose history, appointments, questions,
          transition checklist, private Care Vault files, care contacts,
          communication history, shared care tasks and completion history,
          caregiver shift handoffs, packet workflow history, care-sharing
          records and care activity history.
        </Txt>
        <Txt style={S.small}>
          Support and coaching requests are detached from the deleted care
          profile instead of being silently erased.
        </Txt>

        {isOwner && hasCareProfile ? (
          <>
            <Txt style={S.small}>
              Type <Text style={S.h3}>{state.careRecipientName}</Text> exactly
              to confirm.
            </Txt>
            <Field
              label="Care profile name"
              value={careConfirmation}
              onChange={setCareConfirmation}
            />
            <Button
              title={busy === "care-delete" ? "Deleting care profile…" : "Delete care profile permanently"}
              secondary
              disabled={
                busy !== null ||
                careConfirmation !== state.careRecipientName ||
                !state.careRecipientId
              }
              onPress={() =>
                void run("care-delete", async () => {
                  if (!state.careRecipientId) return;
                  await deleteCareRecipientData({
                    careRecipientId: state.careRecipientId,
                    confirmationName: careConfirmation,
                  });
                  setCareConfirmation("");
                  await refresh();
                  n.reset({ index: 0, routes: [{ name: "Onboarding" }] });
                })
              }
            />
          </>
        ) : (
          <Txt style={S.small}>
            Only the care owner can delete this care profile.
          </Txt>
        )}
      </Card>

      <Section title="Delete your account" />
      <Card style={{ borderColor: "#E7C3C7" }}>
        <Text style={[S.h3, { color: C.rose }]}>Permanent account deletion</Text>
        <Txt>
          Deleting your account removes your EnVizion sign-in, preferences,
          saved resources, care memberships and your own support/coaching
          requests.
        </Txt>
        <Txt>
          Shared care entries you previously contributed are preserved for the
          care recipient, but your author identity is detached from those
          records.
        </Txt>
        <Txt style={S.small}>
          You must delete every care profile you own first. Staff/admin
          accounts require review by another administrator before deletion.
        </Txt>

        <Field
          label="Type DELETE"
          value={deleteWord}
          onChange={setDeleteWord}
        />
        <Field
          label="Confirm account email"
          value={deleteEmail}
          onChange={setDeleteEmail}
        />
        <View style={{ gap: 8 }}>
          <Text style={[S.h3, { fontSize: 13 }]}>Current password</Text>
          <TextInput
            accessibilityLabel="Current password"
            value={deletePassword}
            onChangeText={setDeletePassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            secureTextEntry
            style={S.input}
            placeholder="Re-enter your password"
            placeholderTextColor="#AAA0AF"
          />
        </View>
        <Button
          title={busy === "account-delete" ? "Deleting account…" : "Delete my account permanently"}
          secondary
          disabled={
            busy !== null ||
            deleteWord !== "DELETE" ||
            deleteEmail.trim().toLowerCase() !== accountEmail.toLowerCase() ||
            !deletePassword
          }
          onPress={() =>
            void run("account-delete", async () => {
              await deleteOwnAccount({
                email: deleteEmail,
                password: deletePassword,
                confirmation: deleteWord,
              });
            })
          }
        />
      </Card>

      <Card style={{ backgroundColor: C.lavender }}>
        <Text style={S.h3}>Important</Text>
        <Txt>
          These controls manage data stored by EnVizion Life. They do not
          replace legal privacy notices, clinical record-retention obligations,
          or organizational policies that may apply when the program launches.
        </Txt>
      </Card>
    </Page>
  );
}
