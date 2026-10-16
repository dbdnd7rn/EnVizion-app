import { themeForeground, themeBorder } from "../themeColors";
import { useAppearance } from "../appearance";
import { AdminGlassHero, AdminGlassCard, AdminGlassSection, AdminGlassMetric, AdminGlassTabs } from "../components/AdminGlassUi";
import { themeBackground, themeAction } from "../themeColors";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import {
  invitePilotParticipant,
  loadPilotAdminAudit,
  loadPilotParticipants,
  loadPilotSummary,
  loadPilotCohortProgress,
  loadPilotFeedback,
  loadPilotOperations,
  loadProgramDocuments,
  publishProgramDocument,
  retireProgramDocument,
  saveProgramDocument,
  updatePilotParticipant,
  updatePilotFeedback,
  closeoutPilotParticipant,
  resolvePilotDiagnostic,
  type PilotAdminAudit,
  type PilotParticipant,
  type PilotStatus,
  type PilotSummary,
  type PilotCohortProgress,
  type PilotFeedbackItem,
  type PilotOperationsSummary,
  type ProgramDocument,
  type ProgramDocumentType,
} from "../pilot";
import { getStaffMembership } from "../staff";
import { launchReadiness } from "../launchReadiness";
import {
  pilotOnboardingProgress,
  pilotOnboardingStageLabel,
  pilotOnboardingSteps,
} from "../pilotOnboardingHelpers";
import { useNav } from "./MainScreens";
import {
  Button,
  C,
  Field,
  Icon,
  Page,
  S,
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

function Metric({ value, label }: { value: number; label: string }) {
  const icon = label.includes("document") || label.includes("consent") ? "document-text-outline" :
    label.includes("support") || label.includes("coaching") ? "chatbubbles-outline" :
    label.includes("blocked") || label.includes("error") || label.includes("failed") ? "alert-circle-outline" :
    label.includes("ready") || label.includes("complete") || label.includes("validation") ? "checkmark-circle-outline" :
    "people-outline";
  return <AdminGlassMetric value={value} label={label} icon={icon} />;
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
  const { dark } = useAppearance();
  const n = useNav();
  const [summary, setSummary] = useState<PilotSummary | null>(null);
  const [operations, setOperations] =
    useState<PilotOperationsSummary | null>(null);
  const [participants, setParticipants] = useState<PilotParticipant[]>([]);
  const [cohorts, setCohorts] = useState<PilotCohortProgress[]>([]);
  const [feedback, setFeedback] = useState<PilotFeedbackItem[]>([]);
  const [documents, setDocuments] = useState<ProgramDocument[]>([]);
  const [audit, setAudit] = useState<PilotAdminAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<"overview" | "participants" | "governance">("overview");

  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteCohort, setInviteCohort] = useState("Pilot 1");
  const [closeoutNotes, setCloseoutNotes] = useState<Record<string, string>>({});

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

      const [
        nextSummary,
        nextCohorts,
        nextOperations,
        nextParticipants,
        nextFeedback,
        nextDocuments,
        nextAudit,
      ] = await Promise.all([
        loadPilotSummary(),
        loadPilotCohortProgress(),
        loadPilotOperations(),
        loadPilotParticipants(),
        loadPilotFeedback(),
        loadProgramDocuments(),
        loadPilotAdminAudit(),
      ]);

      setSummary(nextSummary);
      setCohorts(nextCohorts);
      setOperations(nextOperations);
      setParticipants(nextParticipants);
      setFeedback(nextFeedback);
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

  const readyToActivate = useMemo(
    () =>
      participants.filter(
        (participant) =>
          participant.status !== "active" &&
          participant.status !== "exited" &&
          participant.readyForActivation,
      ),
    [participants],
  );

  const readiness = useMemo(
    () =>
      launchReadiness({
        pilot: summary,
        operations,
        publishedRequiredDocuments: currentDocuments.length,
      }),
    [currentDocuments.length, operations, summary],
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
      <AdminGlassHero
        variant="pilot" eyebrow="PILOT ADMINISTRATION"
        title="A clearer view of your pilot."
        description="Track onboarding, consent, operational readiness and participant progress without accessing clinical records."
        footer={<Text style={[S.small, { color: C.purple, fontFamily: "DMSans_600SemiBold" }]}>
          Secure, role-based administration
        </Text>}
      />
      {summary && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 10, justifyContent: "space-between" }}>
          <AdminGlassMetric icon="people-outline" value={summary.activePilot} label="Active participants" />
          <AdminGlassMetric icon="person-add-outline" value={summary.invitedPilot} label="Invited participants" />
          <AdminGlassMetric icon="checkmark-circle-outline" value={summary.readyForActivation} label="Ready for activation" />
          <AdminGlassMetric icon="shield-checkmark-outline" value={summary.currentRequiredDocuments} label="Published documents" />
        </View>
      )}
      <AdminGlassTabs
        options={[
          { key: "overview", label: "Overview", icon: "grid-outline" },
          { key: "participants", label: "Participants", icon: "people-outline" },
          { key: "governance", label: "Governance", icon: "shield-checkmark-outline" },
        ]}
        value={tab} onChange={setTab}
      />
      {Boolean(message) && (
        <AdminGlassCard style={{ backgroundColor: themeBackground(C.white) }}>
          <Text accessibilityRole="alert" style={S.body}>
            {message}
          </Text>
        </AdminGlassCard>
      )}

      {tab === "overview" && (<>
      {summary && (
        <>
          <AdminGlassSection title="Pilot overview" action="Refresh" onPress={() => void refresh()} />
          <AdminGlassCard>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              <Metric value={summary.activePilot} label="active pilot users" />
              <Metric value={summary.invitedPilot} label="invited" />
              <Metric value={summary.pausedPilot} label="paused" />
              <Metric value={summary.exitedPilot} label="exited" />
            </View>
          </AdminGlassCard>

          <AdminGlassCard style={{ backgroundColor: C.lavender }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
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
          </AdminGlassCard>

          <AdminGlassCard style={{ backgroundColor: themeBackground("#FFF9F2") }}>
            <Text style={S.eyebrow}>ONBOARDING COMMAND CENTER</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              <Metric
                value={summary.readyForActivation}
                label="ready for activation"
              />
              <Metric
                value={summary.activeLaunchReady}
                label="active + launch ready"
              />
              <Metric
                value={summary.onboardingBlocked}
                label="onboarding blocked"
              />
            </View>
          </AdminGlassCard>

          <AdminGlassCard style={{ backgroundColor: C.lavender }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              <Metric
                value={summary.stalledParticipants}
                label="stalled over 72h"
              />
              <Metric
                value={cohorts.reduce((sum, item) => sum + item.passedValidation, 0)}
                label="participants with passed validation"
              />
              <Metric
                value={cohorts.reduce((sum, item) => sum + item.completed, 0)}
                label="pilot journeys completed"
              />
            </View>
          </AdminGlassCard>

          <AdminGlassCard>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              <Metric value={summary.openSupport} label="open support" />
              <Metric value={summary.activeCoaching} label="active coaching" />
              <Metric value={summary.totalAccounts} label="total Auth accounts" />
            </View>
          </AdminGlassCard>
        </>
      )}

      <AdminGlassSection title="Cohort progress" />
      {!cohorts.length ? (
        <AdminGlassCard>
          <Txt>No pilot cohorts exist yet.</Txt>
        </AdminGlassCard>
      ) : (
        cohorts.map((cohort) => (
          <AdminGlassCard key={cohort.cohort}>
            <View style={S.between}>
              <View style={{ flex: 1 }}>
                <Text style={S.h2}>{cohort.cohort}</Text>
                <Txt style={S.small}>
                  {cohort.total} participants · {cohort.active} active ·{" "}
                  {cohort.exited} exited
                </Txt>
              </View>
              <View
                style={[
                  S.pill,
                  {
                    backgroundColor:
                      cohort.stalled > 0 ? "#FFF1E5" : "#E8F1ED",
                  },
                ]}
              >
                <Text
                  style={[
                    S.small,
                    { color: cohort.stalled > 0 ? C.rose : C.green },
                  ]}
                >
                  {cohort.stalled > 0
                    ? `${cohort.stalled} stalled`
                    : "No stalled users"}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
              <Metric
                value={cohort.consentComplete}
                label="consent complete"
              />
              <Metric
                value={cohort.readyForActivation}
                label="ready to activate"
              />
              <Metric value={cohort.launchReady} label="launch ready" />
              <Metric
                value={cohort.passedValidation}
                label="passed validation"
              />
              <Metric value={cohort.completed} label="completed" />
            </View>
          </AdminGlassCard>
        ))
      )}

      {operations && (
        <>
          <AdminGlassSection title="Launch readiness" />
          <AdminGlassCard
            style={{
              backgroundColor:
                readiness.level === "ready"
                  ? "#E8F1ED"
                  : readiness.level === "blocked"
                    ? C.redBg
                    : "#FFF9F2",
            }}
          >
            <View style={S.between}>
              <View style={{ flex: 1 }}>
                <Text style={S.eyebrow}>RELEASE SIGNAL</Text>
                <Text style={S.h2}>
                  {readiness.level === "ready"
                    ? "Operational signals are clear"
                    : readiness.level === "blocked"
                      ? "Release blockers need attention"
                      : "Review before wider rollout"}
                </Text>
              </View>
              <Icon
                name={
                  readiness.level === "ready"
                    ? "checkmark-circle-outline"
                    : readiness.level === "blocked"
                      ? "close-circle-outline"
                      : "warning-outline"
                }
                color={
                  readiness.level === "ready"
                    ? C.green
                    : readiness.level === "blocked"
                      ? C.rose
                      : C.purple
                }
                size={30}
              />
            </View>
            {!readiness.issues.length ? (
              <Txt>
                Consent, packet export, support aging, push delivery and
                diagnostics currently show no release-readiness issues.
              </Txt>
            ) : (
              readiness.issues.map((issue) => (
                <Txt key={issue} style={S.small}>
                  • {issue}
                </Txt>
              ))
            )}
            <Txt style={S.small}>
              This is an operational checklist, not a clinical-safety,
              regulatory, legal, or compliance certification.
            </Txt>
          </AdminGlassCard>

          <AdminGlassSection title="Production operations" />
          <AdminGlassCard style={{ backgroundColor: C.lavender }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              <Metric
                value={operations.openDiagnostics}
                label="open diagnostics"
              />
              <Metric
                value={operations.failedPacketExports24h}
                label="failed packet exports · 24h"
              />
              <Metric
                value={operations.staleSupportRequests}
                label="support requests older than 24h"
              />
              <Metric
                value={operations.pushDeliveryErrors24h}
                label="push delivery errors · 24h"
              />
            </View>
          </AdminGlassCard>

          <AdminGlassCard>
            <View style={S.row}>
              <Icon name="shield-checkmark-outline" size={24} />
              <View style={{ flex: 1 }}>
                <Text style={S.h3}>Operational boundary</Text>
                <Txt style={S.small}>
                  These metrics intentionally use workflow status and technical
                  diagnostics only. Medication names, observations, document
                  contents, appointment notes and family messages are not
                  exposed here.
                </Txt>
              </View>
            </View>
          </AdminGlassCard>

          <AdminGlassSection title="Recent technical diagnostics" />
          {!operations.recentDiagnostics.length ? (
            <AdminGlassCard>
              <Txt>No client diagnostics have been submitted.</Txt>
            </AdminGlassCard>
          ) : (
            operations.recentDiagnostics.slice(0, 10).map((report) => (
              <AdminGlassCard key={report.id}>
                <View style={S.between}>
                  <View style={{ flex: 1 }}>
                    <Text style={S.h3}>{report.summary}</Text>
                    <Txt style={S.small}>
                      {report.displayName} · {report.platform || "platform unavailable"}
                      {report.appVersion ? ` · v${report.appVersion}` : ""}
                    </Txt>
                  </View>
                  <StatusPill status={report.status} />
                </View>
                <Txt style={S.small}>
                  {report.area.replaceAll("_", " ")} ·{" "}
                  {new Date(report.createdAt).toLocaleString()}
                </Txt>
                {Object.keys(report.details).length > 0 && (
                  <Txt style={S.small}>
                    {Object.entries(report.details)
                      .filter(([, value]) => value !== null && value !== "")
                      .slice(0, 4)
                      .map(([key, value]) =>
                        `${key.replaceAll("_", " ")}: ${String(value)}`,
                      )
                      .join(" · ")}
                  </Txt>
                )}
                {report.status !== "resolved" && (
                  <Button
                    title={
                      busy === `diagnostic-${report.id}`
                        ? "Resolving…"
                        : "Mark diagnostic resolved"
                    }
                    secondary
                    disabled={busy !== null}
                    onPress={() =>
                      void run(
                        `diagnostic-${report.id}`,
                        () => resolvePilotDiagnostic(report.id),
                        "Diagnostic marked resolved.",
                      )
                    }
                  />
                )}
              </AdminGlassCard>
            ))
          )}
        </>
      )}

      </>)}

      {tab === "governance" && (<>
      <AdminGlassSection title="Pilot metrics & launch intelligence" />
      <AdminGlassCard style={{ backgroundColor: C.deep }}>
        <Icon name="analytics-outline" color={C.white} size={28} />
        <Text style={[S.h2, { color: C.white }]}>Final pilot intelligence</Text>
        <Txt style={{ color: themeForeground("#E3D5E9") }}>
          Compare the live onboarding funnel, device and platform results,
          feedback trends, launch waves, outcomes and clinical-content readiness.
        </Txt>
        <Button
          title="Open Pilot Intelligence"
          icon="bar-chart-outline"
          onPress={() => n.navigate("PilotIntelligence")}
        />
      </AdminGlassCard>

      <AdminGlassSection title="Access governance" />
      <AdminGlassCard
        style={{
          backgroundColor: themeBackground("#FAF7FB"),
          borderColor: themeBorder("#E4D9E8"),
          gap: 11,
        }}
      >
        <View style={S.between}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 17,
              backgroundColor: themeBackground("#F1E7F5"),
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="shield-checkmark-outline" size={24} color={C.purple} />
          </View>
          <View style={[S.pill, { backgroundColor: themeBackground(C.white) }]}>
            <Text style={[S.small, { color: C.purple }]}>ADMIN ONLY</Text>
          </View>
        </View>
        <Text style={S.h2}>Access Governance Dashboard</Text>
        <Txt>
          Monitor 90-day care-team access reviews across care profiles, see
          overdue escalation status, coverage gaps and recent Primary Advocate
          sign-offs without exposing clinical care records.
        </Txt>
        <Button
          title="Open Access Governance"
          icon="shield-outline"
          onPress={() => n.navigate("AccessGovernanceAdmin")}
        />
      </AdminGlassCard>

      <AdminGlassSection title="Launch validation" />
      <AdminGlassCard style={{ backgroundColor: C.lavender }}>
        <Icon name="flag-outline" size={28} />
        <Text style={S.h3}>Final launch evidence & sign-off</Text>
        <Txt>
          Create pilot launch waves, review real Primary Advocate/Co-Caregiver/Care Recipient/Family Member
          journeys, device QA and recovery drills, then record a controlled
          hold or approval.
        </Txt>
        <Button
          title="Open Launch Center"
          icon="rocket-outline"
          onPress={() => n.navigate("LaunchCenter")}
        />
      </AdminGlassCard>

      <AdminGlassSection title="Pilot feedback triage" />
      {!feedback.length ? (
        <AdminGlassCard>
          <Icon name="chatbubble-ellipses-outline" size={26} />
          <Text style={S.h3}>No pilot feedback has been submitted yet.</Text>
          <Txt style={S.small}>
            Tester bugs, experience notes and suggestions will appear here.
          </Txt>
        </AdminGlassCard>
      ) : (
        feedback.slice(0, 30).map((item) => {
          const isBug = item.source === "diagnostic";
          const done =
            item.status === "closed" || item.status === "resolved";
          return (
            <AdminGlassCard key={item.source + "-" + item.id}>
              <View style={S.between}>
                <View style={{ flex: 1 }}>
                  <Text style={S.eyebrow}>
                    {item.category.toUpperCase()} · {item.source.toUpperCase()}
                  </Text>
                  <Text style={S.h3}>{item.summary}</Text>
                  <Txt style={S.small}>
                    {item.displayName} ·{" "}
                    {new Date(item.createdAt).toLocaleString()}
                    {item.platform ? ` · ${item.platform}` : ""}
                    {item.appVersion ? ` · v${item.appVersion}` : ""}
                  </Txt>
                </View>
                <StatusPill status={item.status} />
              </View>
              {Boolean(item.detail) && <Txt>{item.detail}</Txt>}
              {!done && (
                <View style={{ gap: 8 }}>
                  <Button
                    title={isBug ? "Mark reviewed" : "Move to review"}
                    secondary
                    disabled={busy !== null || item.status === "reviewed" || item.status === "in_review"}
                    onPress={() =>
                      void run(
                        `feedback-review-${item.id}`,
                        () =>
                          updatePilotFeedback({
                            feedbackId: item.id,
                            source: item.source,
                            status: isBug ? "reviewed" : "in_review",
                          }),
                        "Pilot feedback moved into review.",
                      )
                    }
                  />
                  <Button
                    title={isBug ? "Resolve bug feedback" : "Close feedback"}
                    disabled={busy !== null}
                    onPress={() =>
                      void run(
                        `feedback-close-${item.id}`,
                        () =>
                          updatePilotFeedback({
                            feedbackId: item.id,
                            source: item.source,
                            status: isBug ? "resolved" : "closed",
                          }),
                        "Pilot feedback closed.",
                      )
                    }
                  />
                </View>
              )}
            </AdminGlassCard>
          );
        })
      )}

      <AdminGlassSection title="Required participation documents" />
      {!documents.length ? (
        <AdminGlassCard>
          <Txt>
            No program documents exist yet. Caregivers are not blocked by a
            consent gate until an administrator publishes a document.
          </Txt>
        </AdminGlassCard>
      ) : (
        documents.map((item) => (
          <AdminGlassCard key={item.id}>
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
          </AdminGlassCard>
        ))
      )}

      <AdminGlassSection title={documentId ? "Edit draft" : "Create document draft"} />
      <AdminGlassCard>
        <Text style={S.h3}>Document type</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {(Object.keys(documentLabels) as ProgramDocumentType[]).map((type) => (
            <Pressable
              key={type}
              accessibilityRole="radio"
              accessibilityState={{ selected: documentType === type }}
              disabled={busy !== null || documentId !== null}
              onPress={() => setDocumentType(type)}
              style={[
                S.pill,
                {
                  minHeight: 42,
                  justifyContent: "center",
                  paddingHorizontal: 12,
                  opacity: documentId ? 0.7 : 1,
                  backgroundColor:
                    documentType === type ? themeAction(C.purple) : C.lavender,
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
      </AdminGlassCard>

      <AdminGlassSection title="Admin activity" />
      {!audit.length ? (
        <AdminGlassCard>
          <Txt>No pilot admin actions have been recorded yet.</Txt>
        </AdminGlassCard>
      ) : (
        audit.slice(0, 20).map((entry) => (
          <AdminGlassCard key={entry.id}>
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
          </AdminGlassCard>
        ))
      )}

      </>)}

      {tab === "participants" && (<>
      <AdminGlassSection title="Invite pilot participant" />
      <AdminGlassCard>
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
      </AdminGlassCard>

      <AdminGlassSection title="Stalled onboarding follow-up" />
      {!participants.some((participant) => participant.stalled) ? (
        <AdminGlassCard style={{ backgroundColor: themeBackground("#E8F1ED") }}>
          <Icon name="checkmark-circle-outline" color={C.green} size={26} />
          <Text style={S.h3}>No participant is stalled over 72 hours.</Text>
          <Txt style={S.small}>
            The scheduled reminder sweep runs every 6 hours and deduplicates
            the same onboarding stage for 72 hours.
          </Txt>
        </AdminGlassCard>
      ) : (
        participants
          .filter((participant) => participant.stalled)
          .map((participant) => (
            <AdminGlassCard
              key={"stalled-" + participant.userId}
              style={{ backgroundColor: themeBackground("#FFF9F2") }}
            >
              <View style={S.between}>
                <View style={{ flex: 1 }}>
                  <Text style={S.eyebrow}>STALLED ONBOARDING</Text>
                  <Text style={S.h3}>{participant.displayName}</Text>
                  <Txt style={S.small}>
                    {pilotOnboardingStageLabel(participant.onboardingStage)} ·{" "}
                    {participant.stalledHours}h in current stage
                  </Txt>
                </View>
                <Icon name="time-outline" color={C.rose} size={25} />
              </View>
              <Txt>{participant.nextAction}</Txt>
            </AdminGlassCard>
          ))
      )}

      <AdminGlassSection title="Activation command center" />
      {!readyToActivate.length ? (
        <AdminGlassCard style={{ backgroundColor: C.lavender }}>
          <Icon name="lock-closed-outline" size={26} />
          <Text style={S.h3}>No participant is ready for activation yet.</Text>
          <Txt style={S.small}>
            Activation unlocks automatically after invitation acceptance,
            first sign-in, all current participation documents, and a real
            Primary Advocate/Co-Caregiver/Care Recipient/Family Member care-profile role are complete.
          </Txt>
        </AdminGlassCard>
      ) : (
        readyToActivate.map((participant) => (
          <AdminGlassCard
            key={"ready-" + participant.userId}
            style={{ backgroundColor: themeBackground("#E8F1ED") }}
          >
            <View style={S.between}>
              <View style={{ flex: 1 }}>
                <Text style={S.eyebrow}>READY FOR ACTIVATION</Text>
                <Text style={S.h3}>{participant.displayName}</Text>
                <Txt style={S.small}>
                  {participant.cohort || "No cohort"} · all prerequisites complete
                </Txt>
              </View>
              <Icon
                name="checkmark-circle-outline"
                color={C.green}
                size={28}
              />
            </View>
            <Button
              title={
                busy === `participant-${participant.userId}`
                  ? "Activating…"
                  : "Activate for pilot testing"
              }
              icon="play-circle-outline"
              disabled={busy !== null}
              onPress={() =>
                void run(
                  `participant-${participant.userId}`,
                  () =>
                    updatePilotParticipant({
                      userId: participant.userId,
                      status: "active",
                      cohort: participant.cohort,
                    }),
                  "Participant activated and ready for pilot launch validation.",
                )
              }
            />
          </AdminGlassCard>
        ))
      )}

      <AdminGlassSection title="Pilot participants" />
      {!participants.length ? (
        <AdminGlassCard>
          <Txt>No pilot participants have been enrolled yet.</Txt>
        </AdminGlassCard>
      ) : (
        participants.map((participant) => {
          const progress = pilotOnboardingProgress(participant);
          const steps = pilotOnboardingSteps(participant);
          const stageLabel = pilotOnboardingStageLabel(
            participant.onboardingStage,
          );

          return (
            <AdminGlassCard key={participant.userId}>
              <View style={S.between}>
                <View style={{ flex: 1 }}>
                  <Text style={S.h3}>{participant.displayName}</Text>
                  <Txt style={S.small}>{participant.email}</Txt>
                  <Txt style={S.small}>
                    {participant.cohort || "No cohort"} · {progress.complete}/
                    {progress.total} onboarding stages complete
                  </Txt>
                </View>
                <View
                  style={[
                    S.pill,
                    {
                      backgroundColor: participant.launchTestingReady
                        ? "#E8F1ED"
                        : participant.readyForActivation
                          ? C.lavender
                          : "#FFF1E5",
                    },
                  ]}
                >
                  <Text
                    style={[
                      S.small,
                      {
                        color: participant.launchTestingReady
                          ? C.green
                          : participant.readyForActivation
                            ? C.purple
                            : C.rose,
                      },
                    ]}
                  >
                    {stageLabel}
                  </Text>
                </View>
              </View>

              <AdminGlassCard style={{ backgroundColor: C.paper }}>
                <Text style={S.h3}>Onboarding evidence</Text>
                {steps.map((step) => (
                  <View
                    key={step.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: 9,
                    }}
                  >
                    <Icon
                      name={
                        step.complete
                          ? "checkmark-circle-outline"
                          : "ellipse-outline"
                      }
                      color={step.complete ? C.green : C.muted}
                      size={19}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[S.h3, { fontSize: 13 }]}>
                        {step.title}
                      </Text>
                      <Txt style={S.small}>{step.detail}</Txt>
                    </View>
                  </View>
                ))}
              </AdminGlassCard>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                <View style={{ flex: 1, minWidth: 130 }}>
                  <Text style={S.h3}>Documents</Text>
                  <Txt style={S.small}>
                    {participant.documents.accepted}/
                    {participant.documents.required} accepted
                  </Txt>
                </View>
                <View style={{ flex: 1, minWidth: 130 }}>
                  <Text style={S.h3}>Care roles</Text>
                  <Txt style={S.small}>
                    Primary Advocate {participant.roles.owner} · Co-Caregiver{" "}
                    {participant.roles.caregiver} · Care Recipient{" "}
                    {participant.roles.patient} · Family Member{" "}
                    {participant.roles.viewer}
                  </Txt>
                </View>
              </View>

              {participant.documents.outstanding.length > 0 && (
                <AdminGlassCard style={{ backgroundColor: themeBackground("#FFF9F2") }}>
                  <Text style={S.h3}>Outstanding documents</Text>
                  {participant.documents.outstanding.map((document) => (
                    <Txt key={document.id} style={S.small}>
                      • {document.title} · v{document.version}
                    </Txt>
                  ))}
                </AdminGlassCard>
              )}

              {participant.activationBlockers.length > 0 &&
                participant.status !== "exited" && (
                  <AdminGlassCard style={{ backgroundColor: themeBackground("#FFF9F2") }}>
                    <Text style={S.h3}>Activation blockers</Text>
                    {participant.activationBlockers.map((blocker) => (
                      <Txt key={blocker} style={S.small}>
                        • {blocker}
                      </Txt>
                    ))}
                  </AdminGlassCard>
                )}

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {(["active", "paused"] as const).map((status) => {
                  const activationLocked =
                    status === "active" && !participant.readyForActivation;
                  const disabled =
                    busy !== null ||
                    participant.status === status ||
                    activationLocked;

                  return (
                    <Pressable
                      key={status}
                      accessibilityRole="button"
                      accessibilityState={{
                        selected: participant.status === status,
                        disabled,
                      }}
                      disabled={disabled}
                      onPress={() =>
                        void run(
                          `participant-${participant.userId}`,
                          () =>
                            updatePilotParticipant({
                              userId: participant.userId,
                              status,
                              cohort: participant.cohort,
                            }),
                          `Participant moved to ${statusLabels[
                            status
                          ].toLowerCase()}.`,
                        )
                      }
                      style={[
                        S.pill,
                        {
                          minHeight: 42,
                          justifyContent: "center",
                          paddingHorizontal: 13,
                          opacity: disabled ? 0.55 : 1,
                          backgroundColor:
                            participant.status === status
                              ? themeAction(C.purple)
                              : C.lavender,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          S.h3,
                          {
                            fontSize: 12,
                            color:
                              participant.status === status
                                ? C.white
                                : C.deep,
                          },
                        ]}
                      >
                        {status === "active" && activationLocked
                          ? "Active · locked"
                          : statusLabels[status]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {!participant.roles.ready &&
                participant.status !== "exited" && (
                  <Txt style={S.small}>
                    Care-role access is intentionally not assigned from Pilot
                    Admin. A Primary Advocate must grant it through the normal
                    care-team invitation and consent workflow.
                  </Txt>
                )}

              {participant.status !== "exited" && (
                <AdminGlassCard style={{ backgroundColor: C.paper }}>
                  <Text style={S.h3}>Pilot closeout</Text>
                  <Txt style={S.small}>
                    Passed validation runs: {participant.validation.passedRuns}
                  </Txt>
                  <Field
                    label="Closeout note (optional)"
                    value={closeoutNotes[participant.userId] ?? ""}
                    onChange={(value) =>
                      setCloseoutNotes((current) => ({
                        ...current,
                        [participant.userId]: value,
                      }))
                    }
                    multiline
                  />
                  <Button
                    title={
                      participant.validation.canCompletePilot
                        ? "Mark pilot journey completed"
                        : "Completion locked · validation required"
                    }
                    icon="checkmark-done-outline"
                    disabled={
                      busy !== null || !participant.validation.canCompletePilot
                    }
                    onPress={() =>
                      void run(
                        `complete-${participant.userId}`,
                        () =>
                          closeoutPilotParticipant({
                            userId: participant.userId,
                            outcome: "completed",
                            note: closeoutNotes[participant.userId] ?? "",
                          }),
                        "Pilot journey completed with validation evidence.",
                      )
                    }
                  />
                  <Button
                    title="Withdraw / exit pilot"
                    secondary
                    icon="exit-outline"
                    disabled={busy !== null}
                    onPress={() =>
                      void run(
                        `withdraw-${participant.userId}`,
                        () =>
                          closeoutPilotParticipant({
                            userId: participant.userId,
                            outcome: "withdrawn",
                            note: closeoutNotes[participant.userId] ?? "",
                          }),
                        "Participant exited the pilot as withdrawn.",
                      )
                    }
                  />
                </AdminGlassCard>
              )}

              {participant.status === "exited" && participant.completion && (
                <AdminGlassCard
                  style={{
                    backgroundColor:
                      participant.completion.outcome === "completed"
                        ? "#E8F1ED"
                        : "#FFF9F2",
                  }}
                >
                  <Text style={S.h3}>
                    Pilot {participant.completion.outcome}
                  </Text>
                  <Txt style={S.small}>
                    {new Date(participant.completion.createdAt).toLocaleString()} ·{" "}
                    {participant.completion.passedValidationRuns} passed validation
                    run(s)
                  </Txt>
                  {Boolean(participant.completion.note) && (
                    <Txt>{participant.completion.note}</Txt>
                  )}
                </AdminGlassCard>
              )}
            </AdminGlassCard>
          );
        })
      )}

      </>)}

      <AdminGlassCard style={{ backgroundColor: C.lavender }}>
        <Text style={S.h3}>Privacy boundary</Text>
        <Txt>
          This dashboard shows pilot operations, consent completion and support
          workload. It intentionally does not expose medications, observations,
          appointment notes or other clinical care details.
        </Txt>
      </AdminGlassCard>

      {currentDocuments.length === 0 && (
        <Txt style={S.small}>
          No required participation document is currently published, so no
          caregiver is being blocked by the pilot consent gate.
        </Txt>
      )}
    </Page>
  );
}
