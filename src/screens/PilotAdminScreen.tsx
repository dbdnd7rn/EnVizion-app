import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import {
  invitePilotParticipant,
  loadPilotAdminAudit,
  loadPilotParticipants,
  loadPilotSummary,
  loadProgramDocuments,
  publishProgramDocument,
  retireProgramDocument,
  saveProgramDocument,
  updatePilotParticipant,
  type PilotAdminAudit,
  type PilotParticipant,
  type PilotStatus,
  type PilotSummary,
  type ProgramDocument,
  type ProgramDocumentType,
} from "../pilot";
import { getStaffMembership } from "../staff";
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

const documentLabels: Record<ProgramDocumentType, string> = {
  privacy_notice: "Privacy notice",
  pilot_consent: "Pilot consent",
  terms_of_use: "Terms of use",
};

const statusLabels: Record<PilotStatus, string> = {
  invited: "Invited",
  active: "Active",
  paused: "Paused",
  exited: "Exited",
};

function Metric({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  return (
    <View style={{ flex: 1, minWidth: 110 }}>
      <Text style={[S.title, { fontSize: 28, color: C.deep }]}>{value}</Text>
      <Txt style={S.small}>{label}</Txt>
    </View>
  );
}

function StatusPill({ status }: { status: string }) {
  const good = status === "active" || status === "published";
  return (
    <View
      style={[
        S.pill,
        { backgroundColor: good ? "#E8F1ED" : C.lavender },
      ]}
    >
      <Text
        style={[
          S.small,
          {
            color: good ? C.green : C.deep,
            fontFamily: "DMSans_600SemiBold",
          },
        ]}
      >
        {status.replaceAll("_", " ")}
      </Text>
    </View>
  );
}

export function PilotAdminScreen() {
  const [summary, setSummary] = useState<PilotSummary | null>(null);
  const [participants, setParticipants] = useState<PilotParticipant[]>([]);
  const [documents, setDocuments] = useState<ProgramDocument[]>([]);
  const [audit, setAudit] = useState<PilotAdminAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteCohort, setInviteCohort] = useState("Pilot 1");

  const [documentId, setDocumentId] = useState<string | null>(null);
  const [documentType, setDocumentType] =
    useState<ProgramDocumentType>("privacy_notice");
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentBody, setDocumentBody] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const membership = await getStaffMembership();
      if (!membership || membership.role !== "admin") {
        throw new Error("Administrator access required.");
      }

      const [nextSummary, nextParticipants, nextDocuments, nextAudit] =
        await Promise.all([
          loadPilotSummary(),
          loadPilotParticipants(),
          loadProgramDocuments(),
          loadPilotAdminAudit(),
        ]);

      setSummary(nextSummary);
      setParticipants(nextParticipants);
      setDocuments(nextDocuments);
      setAudit(nextAudit);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not load pilot administration.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const currentDocuments = useMemo(
    () => documents.filter((item) => item.status === "published"),
    [documents],
  );

  async function run(
    key: string,
    task: () => Promise<string | void>,
    success?: string,
  ) {
    setBusy(key);
    setMessage("");
    try {
      const taskMessage = await task();
      await refresh();
      setMessage(taskMessage || success || "");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not complete that admin action.",
      );
    } finally {
      setBusy(null);
    }
  }

  function editDocument(item: ProgramDocument) {
    setDocumentId(item.id);
    setDocumentType(item.documentType);
    setDocumentTitle(item.title);
    setDocumentBody(item.body);
    setMessage("Draft loaded into the editor below.");
  }

  function clearDocumentEditor() {
    setDocumentId(null);
    setDocumentType("privacy_notice");
    setDocumentTitle("");
    setDocumentBody("");
  }

  if (loading && !summary) {
    return (
      <Page>
        <ActivityIndicator color={C.purple} />
        <Txt>Loading pilot administration…</Txt>
      </Page>
    );
  }

  return (
    <Page>
      <Heading
        eyebrow="PILOT ADMINISTRATION"
        title="Run the pilot without opening clinical records."
        body="Manage enrollment, required participation documents and operational readiness from one privacy-minimized workspace."
      />

      {Boolean(message) && (
        <Card style={{ backgroundColor: C.white }}>
          <Text accessibilityRole="alert" style={S.body}>
            {message}
          </Text>
        </Card>
      )}

      {summary && (
        <>
          <Section title="Pilot overview" action="Refresh" onPress={() => void refresh()} />
          <Card>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 18 }}>
              <Metric value={summary.activePilot} label="active pilot users" />
              <Metric value={summary.invitedPilot} label="invited" />
              <Metric value={summary.pausedPilot} label="paused" />
              <Metric value={summary.exitedPilot} label="exited" />
            </View>
          </Card>

          <Card style={{ backgroundColor: C.lavender }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 18 }}>
              <Metric
                value={summary.activeConsentComplete}
                label="active users current on required documents"
              />
              <Metric
                value={summary.currentRequiredDocuments}
                label="current published documents"
              />
              <Metric value={summary.careProfiles} label="care profiles" />
            </View>
          </Card>

          <Card>
            <View style={{ flexDirection: "row", gap: 18 }}>
              <Metric value={summary.openSupport} label="open support" />
              <Metric value={summary.activeCoaching} label="active coaching" />
              <Metric value={summary.totalAccounts} label="total Auth accounts" />
            </View>
          </Card>
        </>
      )}

      <Section title="Invite pilot participant" />
      <Card>
        <Field
          label="Participant name"
          value={inviteName}
          onChange={setInviteName}
        />
        <Field
          label="Email address"
          value={inviteEmail}
          onChange={setInviteEmail}
        />
        <Field
          label="Cohort"
          value={inviteCohort}
          onChange={setInviteCohort}
        />
        <Button
          title={busy === "invite" ? "Sending invitation…" : "Invite to pilot"}
          icon="person-add-outline"
          disabled={busy !== null || !inviteEmail.trim()}
          onPress={() =>
            void run(
              "invite",
              async () => {
                const result = await invitePilotParticipant({
                  email: inviteEmail.trim(),
                  displayName: inviteName.trim(),
                  cohort: inviteCohort.trim(),
                });
                setInviteName("");
                setInviteEmail("");
                return result.invitationEmailSent
                  ? "Pilot invitation email sent."
                  : "Pilot enrollment added to the existing EnVizion account.";
              },
            )
          }
        />
        <Txt style={S.small}>
          Invitation enrolls the account as “Invited.” Activation remains an
          explicit admin action. Required published documents are presented to
          the participant in-app.
        </Txt>
      </Card>

      <Section title="Pilot participants" />
      {!participants.length ? (
        <Card>
          <Txt>No pilot participants have been enrolled yet.</Txt>
        </Card>
      ) : (
        participants.map((participant) => (
          <Card key={participant.userId}>
            <View style={S.between}>
              <View style={{ flex: 1 }}>
                <Text style={S.h3}>{participant.displayName}</Text>
                <Txt style={S.small}>{participant.email}</Txt>
              </View>
              <StatusPill status={participant.status} />
            </View>

            <Txt>
              {participant.cohort || "No cohort"} · {participant.careProfileCount}{" "}
              care {participant.careProfileCount === 1 ? "profile" : "profiles"}
            </Txt>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Icon
                name={
                  participant.consentComplete
                    ? "checkmark-circle-outline"
                    : "time-outline"
                }
                color={participant.consentComplete ? C.green : C.purple}
                size={18}
              />
              <Txt style={S.small}>
                {participant.consentComplete
                  ? "Current on required published documents"
                  : "Required document acceptance incomplete"}
              </Txt>
            </View>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {(["active", "paused", "exited"] as const).map((status) => (
                <Pressable
                  key={status}
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: participant.status === status,
                    disabled: busy !== null,
                  }}
                  disabled={busy !== null || participant.status === status}
                  onPress={() =>
                    void run(
                      `participant-${participant.userId}`,
                      () =>
                        updatePilotParticipant({
                          userId: participant.userId,
                          status,
                          cohort: participant.cohort,
                        }),
                      `Participant moved to ${statusLabels[status].toLowerCase()}.`,
                    )
                  }
                  style={[
                    S.pill,
                    {
                      minHeight: 42,
                      justifyContent: "center",
                      paddingHorizontal: 13,
                      opacity:
                        busy !== null || participant.status === status ? 0.6 : 1,
                      backgroundColor:
                        participant.status === status ? C.purple : C.lavender,
                    },
                  ]}
                >
                  <Text
                    style={[
                      S.h3,
                      {
                        fontSize: 12,
                        color:
                          participant.status === status ? C.white : C.deep,
                      },
                    ]}
                  >
                    {statusLabels[status]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Card>
        ))
      )}

      <Section title="Required participation documents" />
      {!documents.length ? (
        <Card>
          <Txt>
            No program documents exist yet. Caregivers are not blocked by a
            consent gate until an administrator publishes a document.
          </Txt>
        </Card>
      ) : (
        documents.map((item) => (
          <Card key={item.id}>
            <View style={S.between}>
              <View style={{ flex: 1 }}>
                <Text style={S.eyebrow}>
                  {documentLabels[item.documentType].toUpperCase()} · VERSION{" "}
                  {item.version}
                </Text>
                <Text style={S.h3}>{item.title}</Text>
              </View>
              <StatusPill status={item.status} />
            </View>

            {item.effectiveAt && (
              <Txt style={S.small}>
                Effective {new Date(item.effectiveAt).toLocaleString()}
              </Txt>
            )}

            {item.status === "draft" && (
              <>
                <Button
                  title="Edit draft"
                  secondary
                  disabled={busy !== null}
                  onPress={() => editDocument(item)}
                />
                <Button
                  title="Publish now"
                  disabled={busy !== null}
                  icon="cloud-upload-outline"
                  onPress={() =>
                    void run(
                      `publish-${item.id}`,
                      () => publishProgramDocument(item.id),
                      "Document published. Enrolled pilot users will be asked to review the current version.",
                    )
                  }
                />
              </>
            )}

            {item.status === "published" && (
              <Button
                title="Retire document"
                secondary
                disabled={busy !== null}
                onPress={() =>
                  void run(
                    `retire-${item.id}`,
                    () => retireProgramDocument(item.id),
                    "Published document retired.",
                  )
                }
              />
            )}
          </Card>
        ))
      )}

      <Section title={documentId ? "Edit draft" : "Create document draft"} />
      <Card>
        <Text style={S.h3}>Document type</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {(Object.keys(documentLabels) as ProgramDocumentType[]).map((type) => (
            <Pressable
              key={type}
              accessibilityRole="radio"
              accessibilityState={{ selected: documentType === type }}
              disabled={busy !== null}
              onPress={() => setDocumentType(type)}
              style={[
                S.pill,
                {
                  minHeight: 42,
                  justifyContent: "center",
                  paddingHorizontal: 12,
                  backgroundColor:
                    documentType === type ? C.purple : C.lavender,
                },
              ]}
            >
              <Text
                style={[
                  S.h3,
                  {
                    fontSize: 11,
                    color: documentType === type ? C.white : C.deep,
                  },
                ]}
              >
                {documentLabels[type]}
              </Text>
            </Pressable>
          ))}
        </View>

        <Field
          label="Title"
          value={documentTitle}
          onChange={setDocumentTitle}
        />
        <Field
          label="Document content"
          value={documentBody}
          onChange={setDocumentBody}
          multiline
        />

        <Button
          title={busy === "document-save" ? "Saving draft…" : "Save draft"}
          disabled={
            busy !== null || !documentTitle.trim() || !documentBody.trim()
          }
          icon="save-outline"
          onPress={() =>
            void run(
              "document-save",
              async () => {
                await saveProgramDocument({
                  documentId,
                  documentType,
                  title: documentTitle.trim(),
                  body: documentBody.trim(),
                });
                clearDocumentEditor();
              },
              "Draft saved. Publishing is a separate admin action.",
            )
          }
        />

        {documentId && (
          <Button
            title="Cancel editing"
            secondary
            disabled={busy !== null}
            onPress={clearDocumentEditor}
          />
        )}

        <Txt style={S.small}>
          Saving does not publish anything. Published participation/privacy
          language should be reviewed by the appropriate EnVizion clinical,
          privacy and legal stakeholders before release.
        </Txt>
      </Card>

      <Section title="Admin activity" />
      {!audit.length ? (
        <Card>
          <Txt>No pilot admin actions have been recorded yet.</Txt>
        </Card>
      ) : (
        audit.slice(0, 20).map((entry) => (
          <Card key={entry.id}>
            <View style={S.between}>
              <Text style={S.eyebrow}>
                {entry.action.replaceAll("_", " ")}
              </Text>
              <Text style={S.small}>
                {new Date(entry.createdAt).toLocaleString()}
              </Text>
            </View>
            <Txt style={S.small}>
              {Object.entries(entry.details)
                .filter(([, value]) => value !== null && value !== "")
                .slice(0, 4)
                .map(([key, value]) => `${key.replaceAll("_", " ")}: ${String(value)}`)
                .join(" · ") || "Recorded admin action"}
            </Txt>
          </Card>
        ))
      )}

      <Card style={{ backgroundColor: C.lavender }}>
        <Text style={S.h3}>Privacy boundary</Text>
        <Txt>
          This dashboard shows pilot operations, consent completion and support
          workload. It intentionally does not expose medications, observations,
          appointment notes or other clinical care details.
        </Txt>
      </Card>

      {currentDocuments.length === 0 && (
        <Txt style={S.small}>
          No required participation document is currently published, so no
          caregiver is being blocked by the pilot consent gate.
        </Txt>
      )}
    </Page>
  );
}
