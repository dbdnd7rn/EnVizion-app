import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import {
  addDoctorVisitQuestion,
  approveDoctorVisitSummary,
  createDoctorVisit,
  deleteDoctorVisitQuestion,
  generateDoctorVisitAiSummary,
  getDoctorVisitAudioUrl,
  loadDoctorVisitCompanion,
  publishDoctorVisitSummary,
  saveManualDoctorVisitSummary,
  deleteDoctorVisitAudio,
  setDoctorVisitRecordingConsent,
  transcribeDoctorVisitAudio,
  updateDoctorVisitCapture,
  updateDoctorVisitQuestion,
  uploadDoctorVisitAudio,
  type DoctorVisitBundle,
  type DoctorVisitSummary,
} from "../doctorVisits";
import {
  localDateTimeToIso,
  reminderLocalParts,
} from "../reminders";
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

type SummaryDraft = {
  summaryText: string;
  newOrders: string;
  actionItems: string;
  redFlags: string;
};

const emptySummary: SummaryDraft = {
  summaryText: "",
  newOrders: "",
  actionItems: "",
  redFlags: "",
};

function lines(value: string) {
  return value
    .split("\n")
    .map((item) => item.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);
}

function listText(items: string[]) {
  return items.join("\n");
}

function statusLabel(status: DoctorVisitBundle["visit"]["status"]) {
  return {
    prep: "Preparing",
    in_visit: "In visit",
    review: "Review summary",
    approved: "Approved",
    published: "Shared",
    cancelled: "Cancelled",
  }[status];
}

function statusColor(status: DoctorVisitBundle["visit"]["status"]) {
  if (status === "published") return "#E8F1ED";
  if (status === "approved") return "#EEF0FF";
  if (status === "review") return "#FFF3E8";
  return "#F3ECFA";
}

function SummaryList({
  title,
  items,
  icon,
}: {
  title: string;
  items: string[];
  icon: string;
}) {
  if (!items.length) return null;

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Icon name={icon} size={18} color={C.purple} />
        <Text style={S.h3}>{title}</Text>
      </View>
      {items.map((item, index) => (
        <View
          key={`${title}-${index}-${item}`}
          style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}
        >
          <Text style={[S.body, { color: C.purple }]}>•</Text>
          <Txt style={{ flex: 1 }}>{item}</Txt>
        </View>
      ))}
    </View>
  );
}

export function DoctorVisitCompanionScreen() {
  const { state } = useCare();
  const careRecipientId = state.careRecipientId;
  const readOnly =
    state.accessRole === "viewer" || state.accessRole === "patient";

  const [bundles, setBundles] = useState<DoctorVisitBundle[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const nowParts = reminderLocalParts(
    state.appointment.date
      ? localDateTimeToIso(
          state.appointment.date,
          state.appointment.time || "09:00",
        ) ?? new Date().toISOString()
      : new Date().toISOString(),
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [physicianName, setPhysicianName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [visitDate, setVisitDate] = useState(nowParts.date);
  const [visitTime, setVisitTime] = useState(nowParts.time || "09:00");
  const [location, setLocation] = useState(state.appointment.location || "");

  const [newQuestion, setNewQuestion] = useState("");
  const [questionCategory, setQuestionCategory] = useState("");
  const [rawNotes, setRawNotes] = useState("");
  const [transcriptText, setTranscriptText] = useState("");
  const [summaryDraft, setSummaryDraft] =
    useState<SummaryDraft>(emptySummary);
  const [shareMessage, setShareMessage] = useState("");

  const refresh = useCallback(async () => {
    if (!careRecipientId) {
      setBundles([]);
      setSelectedId(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const rows = await loadDoctorVisitCompanion(careRecipientId);
      setBundles(rows);
      setSelectedId((current) => {
        if (current && rows.some((item) => item.visit.id === current)) {
          return current;
        }
        return rows[0]?.visit.id ?? null;
      });
      setMessage("");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not load the Doctor Visit Companion.",
      );
    } finally {
      setLoading(false);
    }
  }, [careRecipientId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selected = useMemo(
    () => bundles.find((item) => item.visit.id === selectedId) ?? null,
    [bundles, selectedId],
  );

  const activeSummary = useMemo<DoctorVisitSummary | null>(() => {
    if (!selected) return null;
    return (
      selected.summaries.find((summary) => summary.status === "approved") ??
      selected.summaries.find((summary) => summary.status === "draft") ??
      null
    );
  }, [selected]);

  useEffect(() => {
    if (!selected) {
      setRawNotes("");
      setTranscriptText("");
      setSummaryDraft(emptySummary);
      return;
    }

    setRawNotes(selected.visit.rawNotes);
    setTranscriptText(selected.visit.transcriptText);

    if (activeSummary) {
      setSummaryDraft({
        summaryText: activeSummary.summaryText,
        newOrders: listText(activeSummary.newOrders),
        actionItems: listText(activeSummary.actionItems),
        redFlags: listText(activeSummary.redFlags),
      });
    } else {
      setSummaryDraft(emptySummary);
    }
  }, [activeSummary?.id, selected?.visit.id]);

  async function createVisit() {
    if (!careRecipientId || readOnly || busy) return;

    const appointmentDatetime = localDateTimeToIso(visitDate, visitTime);
    if (!appointmentDatetime) {
      setMessage("Check the visit date and time.");
      return;
    }

    setBusy("create");
    setMessage("");
    try {
      const visit = await createDoctorVisit({
        careRecipientId,
        appointmentId:
          state.appointmentId && state.appointment.date === visitDate
            ? state.appointmentId
            : null,
        physicianName,
        specialty,
        appointmentDatetime,
        location,
      });

      setPhysicianName("");
      setSpecialty("");
      setCreateOpen(false);
      await refresh();
      setSelectedId(visit.id);
      setMessage("Visit companion created. Add questions before the appointment.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "We could not create the visit.",
      );
    } finally {
      setBusy("");
    }
  }

  async function addQuestion() {
    if (!selected || readOnly || busy || !newQuestion.trim()) return;
    setBusy("question");
    try {
      await addDoctorVisitQuestion({
        visitId: selected.visit.id,
        careRecipientId: selected.visit.careRecipientId,
        questionText: newQuestion,
        category: questionCategory,
        position: selected.questions.length,
      });
      setNewQuestion("");
      setQuestionCategory("");
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "We could not add that question.",
      );
    } finally {
      setBusy("");
    }
  }

  async function saveCapture() {
    if (!selected || readOnly || busy) return;
    setBusy("capture");
    try {
      await updateDoctorVisitCapture({
        visitId: selected.visit.id,
        careRecipientId: selected.visit.careRecipientId,
        rawNotes,
        transcriptText,
        status: "in_visit",
      });
      await refresh();
      setMessage("Visit notes saved.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not save the visit notes.",
      );
    } finally {
      setBusy("");
    }
  }

  async function toggleConsent(confirmed: boolean) {
    if (!selected || readOnly || busy) return;
    setBusy("consent");
    try {
      await setDoctorVisitRecordingConsent({
        visitId: selected.visit.id,
        careRecipientId: selected.visit.careRecipientId,
        confirmed,
      });
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not update recording consent.",
      );
    } finally {
      setBusy("");
    }
  }

  async function saveManualSummary() {
    if (!selected || readOnly || busy) return;
    setBusy("summary");
    try {
      const summary = await saveManualDoctorVisitSummary({
        visitId: selected.visit.id,
        careRecipientId: selected.visit.careRecipientId,
        summaryText: summaryDraft.summaryText,
        newOrders: lines(summaryDraft.newOrders),
        actionItems: lines(summaryDraft.actionItems),
        redFlags: lines(summaryDraft.redFlags),
      });
      await refresh();
      setMessage(
        summary.sourceType === "manual"
          ? "Draft summary saved. Review it carefully before approval."
          : "Summary saved.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not save the visit summary.",
      );
    } finally {
      setBusy("");
    }
  }

  async function generateAi() {
    if (!selected || readOnly || busy) return;
    setBusy("ai");
    setMessage("");
    try {
      const summary = await generateDoctorVisitAiSummary(selected.visit.id);
      setSummaryDraft({
        summaryText: summary.summaryText,
        newOrders: listText(summary.newOrders),
        actionItems: listText(summary.actionItems),
        redFlags: listText(summary.redFlags),
      });
      await refresh();
      setMessage(
        "AI draft generated from the saved notes/transcript. Review every item before approval.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The AI draft could not be generated.",
      );
    } finally {
      setBusy("");
    }
  }

  async function approve() {
    if (!selected || !activeSummary || readOnly || busy) return;
    setBusy("approve");
    try {
      await approveDoctorVisitSummary({
        visitId: selected.visit.id,
        careRecipientId: selected.visit.careRecipientId,
        summaryId: activeSummary.id,
      });
      await refresh();
      setMessage("Visit summary approved and ready to share.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not approve this summary.",
      );
    } finally {
      setBusy("");
    }
  }

  async function share() {
    if (!selected || !activeSummary || readOnly || busy) return;
    setBusy("share");
    try {
      const result = await publishDoctorVisitSummary({
        visit: selected.visit,
        summary: activeSummary,
        customMessage: shareMessage,
      });
      await refresh();
      setMessage(
        result.alreadyPublished
          ? "This visit summary is already in the Shared Care Feed."
          : "Visit summary shared with the care team.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not share this visit summary.",
      );
    } finally {
      setBusy("");
    }
  }

  if (!careRecipientId) {
    return (
      <Page>
        <Heading
          eyebrow="DOCTOR VISIT COMPANION"
          title="Choose a care profile first."
          body="Visit preparation and summaries stay attached to one care profile."
        />
      </Page>
    );
  }

  return (
    <Page>
      <Heading
        eyebrow="DOCTOR VISIT COMPANION"
        title="Prepare. Capture. Review. Share."
        body="Keep questions, visit notes, clinician-stated next steps, and the family recap in one guided workflow."
      />

      <Card
        style={{
          backgroundColor: "#2C1839",
          borderWidth: 0,
          overflow: "hidden",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View
            style={{
              width: 58,
              height: 58,
              borderRadius: 20,
              backgroundColor: "#FFFFFF18",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="medkit-outline" size={29} color="#F2DFF7" />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={[S.eyebrow, { color: "#DDBFE8" }]}>ACTIVE CARE PROFILE</Text>
            <Text style={[S.h2, { color: C.white }]}>
              {state.careRecipientName || "Care profile"}
            </Text>
            <Txt style={{ color: "#E6DCE9" }}>
              {readOnly
                ? "Shared visit information · read-only"
                : "Visit companion editing enabled"}
            </Txt>
          </View>
        </View>
      </Card>

      {Boolean(message) && (
        <Card>
          <Text accessibilityRole="alert" style={S.body}>
            {message}
          </Text>
        </Card>
      )}

      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Button
            title={createOpen ? "Close new visit" : "New doctor visit"}
            icon={createOpen ? "close-outline" : "add-circle-outline"}
            secondary={createOpen}
            disabled={readOnly || Boolean(busy)}
            onPress={() => setCreateOpen((value) => !value)}
          />
        </View>
        {bundles.length > 0 && (
          <View style={{ flex: 1 }}>
            <Button
              title="Refresh visits"
              secondary
              disabled={Boolean(busy)}
              onPress={() => void refresh()}
            />
          </View>
        )}
      </View>

      {createOpen && !readOnly && (
        <Card>
          <Text style={S.h2}>Create visit companion</Text>
          <Field
            label="Clinician / physician name"
            value={physicianName}
            onChange={setPhysicianName}
          />
          <Field label="Specialty (optional)" value={specialty} onChange={setSpecialty} />
          <Field
            label="Visit date (YYYY-MM-DD)"
            value={visitDate}
            onChange={setVisitDate}
          />
          <Field
            label="Visit time (HH:MM)"
            value={visitTime}
            onChange={setVisitTime}
          />
          <Field label="Location" value={location} onChange={setLocation} />
          <Button
            title={busy === "create" ? "Creating…" : "Create visit"}
            disabled={Boolean(busy) || !physicianName.trim()}
            onPress={() => void createVisit()}
          />
        </Card>
      )}

      {loading && !bundles.length ? (
        <Card>
          <ActivityIndicator color={C.purple} />
          <Txt>Loading doctor visits…</Txt>
        </Card>
      ) : !bundles.length ? (
        <Card>
          <Icon name="calendar-outline" size={30} color={C.purple} />
          <Text style={S.h2}>No visit companion yet.</Text>
          <Txt>
            Create one before the next appointment so questions, notes, and the
            follow-up recap stay together.
          </Txt>
        </Card>
      ) : (
        <>
          <Section title="Visits" />
          <View style={{ gap: 8 }}>
            {bundles.slice(0, 8).map((bundle) => {
              const active = bundle.visit.id === selectedId;
              const date = new Date(bundle.visit.appointmentDatetime);
              return (
                <Pressable
                  key={bundle.visit.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setSelectedId(bundle.visit.id)}
                  style={[
                    S.card,
                    {
                      padding: 14,
                      borderColor: active ? C.purple : C.line,
                      backgroundColor: active ? "#F7F1FA" : C.white,
                    },
                  ]}
                >
                  <View style={S.between}>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={S.h3}>{bundle.visit.physicianName}</Text>
                      <Txt style={S.small}>
                        {bundle.visit.specialty || "Doctor visit"} ·{" "}
                        {Number.isNaN(date.getTime())
                          ? "Date not available"
                          : date.toLocaleString()}
                      </Txt>
                    </View>
                    <View
                      style={[
                        S.pill,
                        { backgroundColor: statusColor(bundle.visit.status) },
                      ]}
                    >
                      <Text style={[S.small, { fontFamily: "DMSans_600SemiBold" }]}>
                        {statusLabel(bundle.visit.status)}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      {selected && (
        <>
          <Section title="1 · Prepare before the visit" />
          <Card>
            <View style={S.between}>
              <View style={{ flex: 1 }}>
                <Text style={S.h2}>{selected.visit.physicianName}</Text>
                <Txt>
                  {selected.visit.specialty || "Doctor visit"}
                  {selected.visit.location ? ` · ${selected.visit.location}` : ""}
                </Txt>
              </View>
              <Icon name="clipboard-outline" size={27} color={C.purple} />
            </View>

            {!selected.questions.length && (
              <Txt>No questions added yet. Add the things you do not want to forget.</Txt>
            )}

            {selected.questions.map((question) => (
              <Card
                key={question.id}
                style={{
                  backgroundColor: question.isAnswered ? "#F0F6F3" : "#FAF7FC",
                }}
              >
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{
                    checked: question.isAnswered,
                    disabled: readOnly || Boolean(busy),
                  }}
                  disabled={readOnly || Boolean(busy)}
                  onPress={() =>
                    void updateDoctorVisitQuestion({
                      questionId: question.id,
                      careRecipientId: question.careRecipientId,
                      isAnswered: !question.isAnswered,
                      answerNotes: question.answerNotes,
                    }).then(refresh).catch((error) =>
                      setMessage(
                        error instanceof Error
                          ? error.message
                          : "We could not update that question.",
                      ),
                    )
                  }
                  style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}
                >
                  <Icon
                    name={
                      question.isAnswered
                        ? "checkmark-circle"
                        : "ellipse-outline"
                    }
                    color={question.isAnswered ? C.green : C.purple}
                  />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={S.h3}>{question.questionText}</Text>
                    {question.category ? (
                      <Txt style={S.small}>{question.category}</Txt>
                    ) : null}
                  </View>
                </Pressable>

                {!readOnly && (
                  <Button
                    title="Remove question"
                    secondary
                    disabled={Boolean(busy)}
                    onPress={() =>
                      void deleteDoctorVisitQuestion(
                        question.careRecipientId,
                        question.id,
                      )
                        .then(refresh)
                        .catch((error) =>
                          setMessage(
                            error instanceof Error
                              ? error.message
                              : "We could not remove that question.",
                          ),
                        )
                    }
                  />
                )}
              </Card>
            ))}

            {!readOnly && (
              <>
                <Field
                  label="Question to ask"
                  value={newQuestion}
                  onChange={setNewQuestion}
                  multiline
                />
                <Field
                  label="Category (optional)"
                  value={questionCategory}
                  onChange={setQuestionCategory}
                />
                <Button
                  title={busy === "question" ? "Adding…" : "Add question"}
                  secondary
                  disabled={Boolean(busy) || !newQuestion.trim()}
                  onPress={() => void addQuestion()}
                />
              </>
            )}
          </Card>

          <Section title="2 · During the visit" />
          <Card>
            <View style={S.between}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={S.h3}>Recording consent confirmation</Text>
                <Txt style={S.small}>
                  Confirm consent before using any recording feature. Consent
                  requirements can vary by location and care setting.
                </Txt>
              </View>
              <Switch
                accessibilityLabel="Recording consent confirmed"
                disabled={readOnly || Boolean(busy)}
                value={selected.visit.recordingConsentConfirmed}
                onValueChange={(value) => void toggleConsent(value)}
                trackColor={{ true: C.purple }}
              />
            </View>

            {selected.visit.recordingConsentConfirmed && (
              <Card style={{ backgroundColor: "#F2F7F4" }}>
                <Icon name="shield-checkmark-outline" color={C.green} />
                <Text style={S.h3}>Consent confirmation recorded.</Text>
                <Txt style={S.small}>
                  This records who confirmed consent and when. It does not replace
                  applicable recording laws or facility policy.
                </Txt>
              </Card>
            )}

            <Field
              label="Quick visit notes"
              value={rawNotes}
              onChange={setRawNotes}
              multiline
            />
            <Field
              label="Transcript / dictated notes"
              value={transcriptText}
              onChange={setTranscriptText}
              multiline
            />
            {!readOnly && (
              <Button
                title={busy === "capture" ? "Saving visit notes…" : "Save visit notes"}
                icon="save-outline"
                disabled={Boolean(busy)}
                onPress={() => void saveCapture()}
              />
            )}
          </Card>

          <Section title="3 · Review the visit summary" />
          <Card>
            <Card style={{ backgroundColor: "#FFF8EA" }}>
              <Icon name="sparkles-outline" color="#A96D18" />
              <Text style={S.h3}>AI creates a draft — you approve the facts.</Text>
              <Txt style={S.small}>
                The summary tool is instructed to extract only information
                explicitly present in your saved notes or transcript. Review
                medication changes, orders, actions, and warnings before sharing.
              </Txt>
            </Card>

            {!readOnly && (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Button
                    title={busy === "ai" ? "Generating…" : "Generate AI draft"}
                    icon="sparkles-outline"
                    disabled={
                      Boolean(busy) ||
                      (!selected.visit.rawNotes.trim() &&
                        !selected.visit.transcriptText.trim() &&
                        !rawNotes.trim() &&
                        !transcriptText.trim())
                    }
                    onPress={async () => {
                      if (
                        rawNotes !== selected.visit.rawNotes ||
                        transcriptText !== selected.visit.transcriptText
                      ) {
                        await saveCapture();
                      }
                      void generateAi();
                    }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Save manual draft"
                    secondary
                    disabled={Boolean(busy)}
                    onPress={() => void saveManualSummary()}
                  />
                </View>
              </View>
            )}

            <Field
              label="Brief visit recap"
              value={summaryDraft.summaryText}
              onChange={(summaryText) =>
                setSummaryDraft((current) => ({ ...current, summaryText }))
              }
              multiline
            />
            <Field
              label="New orders / medication changes — one per line"
              value={summaryDraft.newOrders}
              onChange={(newOrders) =>
                setSummaryDraft((current) => ({ ...current, newOrders }))
              }
              multiline
            />
            <Field
              label="Action items — one per line"
              value={summaryDraft.actionItems}
              onChange={(actionItems) =>
                setSummaryDraft((current) => ({ ...current, actionItems }))
              }
              multiline
            />
            <Field
              label="Clinician-stated warnings — one per line"
              value={summaryDraft.redFlags}
              onChange={(redFlags) =>
                setSummaryDraft((current) => ({ ...current, redFlags }))
              }
              multiline
            />

            {activeSummary && (
              <Card
                style={{
                  backgroundColor:
                    activeSummary.status === "approved" ? "#EDF5F1" : "#F7F1FA",
                }}
              >
                <View style={S.between}>
                  <View style={{ flex: 1 }}>
                    <Text style={S.h3}>
                      {activeSummary.status === "approved"
                        ? "Approved summary"
                        : "Draft awaiting review"}
                    </Text>
                    <Txt style={S.small}>
                      {activeSummary.sourceType === "ai"
                        ? "AI-assisted draft"
                        : "Manual draft"}
                      {activeSummary.modelName
                        ? ` · ${activeSummary.modelName}`
                        : ""}
                    </Txt>
                  </View>
                  <Icon
                    name={
                      activeSummary.status === "approved"
                        ? "checkmark-circle"
                        : "create-outline"
                    }
                    color={
                      activeSummary.status === "approved" ? C.green : C.purple
                    }
                  />
                </View>
                <Txt>{activeSummary.summaryText || "No brief recap entered."}</Txt>
                <SummaryList
                  title="New orders / changes"
                  items={activeSummary.newOrders}
                  icon="medical-outline"
                />
                <SummaryList
                  title="Action items"
                  items={activeSummary.actionItems}
                  icon="checkbox-outline"
                />
                <SummaryList
                  title="Clinician-stated warnings"
                  items={activeSummary.redFlags}
                  icon="alert-circle-outline"
                />
              </Card>
            )}

            {!readOnly &&
              activeSummary &&
              activeSummary.status === "draft" && (
                <Button
                  title={busy === "approve" ? "Approving…" : "Approve reviewed summary"}
                  icon="checkmark-circle-outline"
                  disabled={Boolean(busy)}
                  onPress={() => void approve()}
                />
              )}
          </Card>

          <Section title="4 · Share with the care team" />
          <Card>
            <Icon name="people-outline" size={29} color={C.purple} />
            <Text style={S.h2}>Send the approved recap to the Shared Care Feed.</Text>
            <Txt>
              Family and caregivers can read the same visit recap without
              rebuilding it from texts, calls, or memory.
            </Txt>
            <Field
              label="Optional family message"
              value={shareMessage}
              onChange={setShareMessage}
              multiline
            />

            {selected.visit.status === "published" ? (
              <Card style={{ backgroundColor: "#EDF5F1" }}>
                <Icon name="checkmark-circle" color={C.green} />
                <Text style={S.h3}>Shared with the care team.</Text>
              </Card>
            ) : (
              !readOnly && (
                <Button
                  title={busy === "share" ? "Sharing…" : "Share approved visit recap"}
                  icon="send-outline"
                  disabled={
                    Boolean(busy) || activeSummary?.status !== "approved"
                  }
                  onPress={() => void share()}
                />
              )
            )}
          </Card>

          <Txt style={S.small}>
            EnVizion Life organizes caregiver-entered and visit-derived
            information. It does not diagnose, interpret symptoms, or replace
            instructions from the treating clinician.
          </Txt>
        </>
      )}
    </Page>
  );
}
