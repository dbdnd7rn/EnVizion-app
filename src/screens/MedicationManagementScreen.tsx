import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import {
  correctManagedMedicationRecord,
  discontinueManagedMedication,
  loadMedicationManagement,
  recordManagedMedicationOutcome,
  reconcileManagedMedicationList,
  saveManagedMedication,
  type ManagedMedication,
  type ManagedMedicationRecord,
  type MedicationOutcome,
  type MedicationReconciliation,
} from "../medicationManagement";
import {
  medicationOutcomeLabel,
  medicationReconciliationLabel,
  medicationRefillState,
} from "../medicationManagementHelpers";
import { supabase } from "../supabase";
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

type Draft = {
  id: string | null;
  name: string;
  instructions: string;
  time: string;
  dose: string;
  route: string;
  purpose: string;
  prescriber: string;
  pharmacy: string;
  isPrn: boolean;
  refillDueOn: string;
};

const emptyDraft: Draft = {
  id: null,
  name: "",
  instructions: "",
  time: "",
  dose: "",
  route: "",
  purpose: "",
  prescriber: "",
  pharmacy: "",
  isPrn: false,
  refillDueOn: "",
};

export function MedicationManagementScreen() {
  const n = useNav();
  const { state, dispatch } = useCare();
  const careRecipientId = state.careRecipientId;
  const readOnly = state.accessRole === "viewer";

  const [medications, setMedications] = useState<ManagedMedication[]>([]);
  const [records, setRecords] = useState<ManagedMedicationRecord[]>([]);
  const [reconciliations, setReconciliations] = useState<
    MedicationReconciliation[]
  >([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editing, setEditing] = useState(false);
  const [recordNotes, setRecordNotes] = useState<Record<string, string>>({});
  const [reconciliationNote, setReconciliationNote] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    if (!careRecipientId) {
      setMedications([]);
      setRecords([]);
      setReconciliations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const result = await loadMedicationManagement(careRecipientId);
      setMedications(result.medications);
      setRecords(result.records);
      setReconciliations(result.reconciliations);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not load medication management.",
      );
    } finally {
      setLoading(false);
    }
  }, [careRecipientId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!careRecipientId) return;
    const channel = supabase
      .channel(`medication-management:${careRecipientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "medications",
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "medication_records",
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "medication_reconciliations",
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [careRecipientId, refresh]);

  const active = useMemo(
    () => medications.filter((medication) => medication.active),
    [medications],
  );
  const latestReconciliation = reconciliations[0] ?? null;
  const refillAttention = useMemo(
    () =>
      active.filter((medication) => {
        const status = medicationRefillState(medication);
        return status === "soon" || status === "overdue";
      }),
    [active],
  );

  function startEdit(medication?: ManagedMedication) {
    if (!medication) {
      setDraft(emptyDraft);
    } else {
      setDraft({
        id: medication.id,
        name: medication.name,
        instructions: medication.instructions,
        time: medication.time,
        dose: medication.dose,
        route: medication.route,
        purpose: medication.purpose,
        prescriber: medication.prescriber,
        pharmacy: medication.pharmacy,
        isPrn: medication.isPrn,
        refillDueOn: medication.refillDueOn,
      });
    }
    setEditing(true);
    setMessage("");
  }

  async function save() {
    if (!careRecipientId || readOnly) return;
    setBusyId("save");
    setMessage("");
    try {
      const medication = await saveManagedMedication({
        careRecipientId,
        ...draft,
      });

      dispatch({
        type: draft.id ? "edit-med" : "add-med",
        medication: {
          id: medication.id,
          name: medication.name,
          instructions: medication.instructions,
          time: medication.time,
        },
      });

      setEditing(false);
      setDraft(emptyDraft);
      await refresh();
      setMessage("Medication details saved.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not save the medication.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function record(
    medication: ManagedMedication,
    status: MedicationOutcome,
  ) {
    if (!careRecipientId || readOnly) return;
    setBusyId("record-" + medication.id);
    setMessage("");
    try {
      const record = await recordManagedMedicationOutcome({
        careRecipientId,
        medicationId: medication.id,
        status,
        note: recordNotes[medication.id] ?? "",
      });
      setRecordNotes((current) => ({ ...current, [medication.id]: "" }));

      if (status === "taken" || status === "prn_taken") {
        dispatch({
          type: "record-med",
          record: {
            id: record.id,
            medication: {
              id: medication.id,
              name: medication.name,
              instructions: medication.instructions,
              time: medication.time,
            },
            recordedAt: record.recordedAt,
          },
        });
      }

      await refresh();
      setMessage(medicationOutcomeLabel(status) + ".");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not save this medication record.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function reconcile() {
    if (!careRecipientId || readOnly) return;
    setBusyId("reconcile");
    setMessage("");
    try {
      await reconcileManagedMedicationList(
        careRecipientId,
        reconciliationNote,
      );
      setReconciliationNote("");
      await refresh();
      setMessage(
        "Medication list reconciled. A point-in-time snapshot was saved for the care team and future handoffs.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not reconcile this medication list.",
      );
    } finally {
      setBusyId(null);
    }
  }

  if (!careRecipientId) {
    return (
      <Page>
        <Heading
          eyebrow="MEDICATION MANAGEMENT"
          title="Choose a care profile first."
        />
      </Page>
    );
  }

  return (
    <Page>
      <Heading
        eyebrow="MEDICATION MANAGEMENT"
        title="Keep the medication list clear, current, and ready to reconcile."
        body="Record what happened, capture refill and pharmacy details, and save a point-in-time reconciliation before handoffs or care transitions."
      />

      <Card style={{ backgroundColor: C.redBg }}>
        <Icon name="shield-checkmark-outline" color={C.rose} />
        <Text style={[S.h3, { color: C.rose }]}>Medication safety</Text>
        <Txt>
          EnVizion records caregiver information; it does not prescribe,
          calculate doses, or tell you to start, stop, hold, or change a
          medication. Follow the pharmacy label and the healthcare team’s
          instructions.
        </Txt>
      </Card>

      <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
        <Card style={{ flex: 1, minWidth: 120 }}>
          <Text style={S.eyebrow}>ACTIVE</Text>
          <Text style={S.h2}>{active.length}</Text>
          <Txt style={S.small}>medications</Txt>
        </Card>
        <Card style={{ flex: 1, minWidth: 120 }}>
          <Text style={S.eyebrow}>RECONCILIATION</Text>
          <Text style={[S.h3, { fontSize: 14 }]}>
            {medicationReconciliationLabel(latestReconciliation)}
          </Text>
        </Card>
        <Card style={{ flex: 1, minWidth: 120 }}>
          <Text style={S.eyebrow}>REFILL ATTENTION</Text>
          <Text style={S.h2}>{refillAttention.length}</Text>
          <Txt style={S.small}>due / overdue</Txt>
        </Card>
      </View>

      <Button
        title="Open daily care plan"
        secondary
        icon="list-outline"
        onPress={() => n.navigate("CarePlan")}
      />

      {Boolean(message) && (
        <Card>
          <Text accessibilityRole="alert" style={S.body}>{message}</Text>
        </Card>
      )}

      <Section title="Active medication list" />
      {loading ? (
        <Card>
          <ActivityIndicator color={C.purple} />
          <Txt>Loading medications…</Txt>
        </Card>
      ) : !active.length ? (
        <Card>
          <Icon name="medical-outline" />
          <Text style={S.h3}>No active medications recorded.</Text>
          <Txt>Add medications from the pharmacy label or current care-team list.</Txt>
        </Card>
      ) : (
        active.map((medication) => {
          const refillState = medicationRefillState(medication);
          return (
            <Card key={medication.id}>
              <View style={S.between}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={S.h2}>{medication.name}</Text>
                  <Txt style={S.small}>
                    {[medication.dose, medication.route, medication.time]
                      .filter(Boolean)
                      .join(" · ") || "Dose / route / time not fully recorded"}
                  </Txt>
                </View>
                {medication.isPrn && (
                  <View style={[S.pill, { backgroundColor: C.lavender }]}>
                    <Txt style={S.small}>PRN / as-needed</Txt>
                  </View>
                )}
              </View>

              <Txt>{medication.instructions}</Txt>
              {Boolean(medication.purpose) && (
                <Txt style={S.small}>Purpose: {medication.purpose}</Txt>
              )}
              {Boolean(medication.prescriber) && (
                <Txt style={S.small}>Prescriber: {medication.prescriber}</Txt>
              )}
              {Boolean(medication.pharmacy) && (
                <Txt style={S.small}>Pharmacy: {medication.pharmacy}</Txt>
              )}
              {Boolean(medication.refillDueOn) && (
                <Txt
                  style={[
                    S.small,
                    refillState === "overdue" || refillState === "soon"
                      ? { color: C.rose }
                      : null,
                  ]}
                >
                  Refill date recorded: {medication.refillDueOn}
                  {refillState === "overdue"
                    ? " · date has passed"
                    : refillState === "soon"
                      ? " · due soon"
                      : ""}
                </Txt>
              )}

              <Field
                label="Optional note for the next record"
                value={recordNotes[medication.id] ?? ""}
                onChange={(value) =>
                  setRecordNotes((current) => ({
                    ...current,
                    [medication.id]: value,
                  }))
                }
                multiline
              />

              <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                <View style={{ flex: 1, minWidth: 120 }}>
                  <Button
                    title="Taken"
                    disabled={readOnly || busyId !== null}
                    onPress={() => void record(medication, "taken")}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 120 }}>
                  <Button
                    title="Not taken"
                    secondary
                    disabled={readOnly || busyId !== null}
                    onPress={() => void record(medication, "not_taken")}
                  />
                </View>
                {medication.isPrn && (
                  <View style={{ flex: 1, minWidth: 120 }}>
                    <Button
                      title="PRN taken"
                      secondary
                      disabled={readOnly || busyId !== null}
                      onPress={() => void record(medication, "prn_taken")}
                    />
                  </View>
                )}
              </View>

              <Button
                title="Edit medication details"
                secondary
                icon="create-outline"
                disabled={readOnly || busyId !== null}
                onPress={() => startEdit(medication)}
              />
              <Button
                title="Mark no longer active"
                secondary
                disabled={readOnly || busyId !== null}
                onPress={async () => {
                  setBusyId("stop-" + medication.id);
                  try {
                    await discontinueManagedMedication(
                      careRecipientId,
                      medication.id,
                    );
                    dispatch({ type: "remove-med", id: medication.id });
                    await refresh();
                    setMessage(
                      medication.name +
                        " moved out of the active list. This records the list change; it is not medical advice to stop a medication.",
                    );
                  } catch (error) {
                    setMessage(
                      error instanceof Error
                        ? error.message
                        : "We could not update the active medication list.",
                    );
                  } finally {
                    setBusyId(null);
                  }
                }}
              />
            </Card>
          );
        })
      )}

      <Button
        title={editing ? "Cancel medication form" : "Add medication"}
        secondary
        icon={editing ? "close-outline" : "add-outline"}
        disabled={readOnly || busyId !== null}
        onPress={() => {
          if (editing) {
            setEditing(false);
            setDraft(emptyDraft);
          } else {
            startEdit();
          }
        }}
      />

      {editing && (
        <Card>
          <Text style={S.h3}>
            {draft.id ? "Edit medication" : "Add medication"}
          </Text>
          <Field
            label="Medication name"
            value={draft.name}
            onChange={(name) => setDraft((current) => ({ ...current, name }))}
          />
          <Field
            label="Dose exactly as listed"
            value={draft.dose}
            onChange={(dose) => setDraft((current) => ({ ...current, dose }))}
          />
          <Field
            label="Route (for example oral, topical)"
            value={draft.route}
            onChange={(route) => setDraft((current) => ({ ...current, route }))}
          />
          <Field
            label="Directions exactly as prescribed"
            value={draft.instructions}
            onChange={(instructions) =>
              setDraft((current) => ({ ...current, instructions }))
            }
            multiline
          />
          <Field
            label="Scheduled time / label"
            value={draft.time}
            onChange={(time) => setDraft((current) => ({ ...current, time }))}
          />
          <Field
            label="Purpose (optional)"
            value={draft.purpose}
            onChange={(purpose) =>
              setDraft((current) => ({ ...current, purpose }))
            }
          />
          <Field
            label="Prescriber (optional)"
            value={draft.prescriber}
            onChange={(prescriber) =>
              setDraft((current) => ({ ...current, prescriber }))
            }
          />
          <Field
            label="Pharmacy (optional)"
            value={draft.pharmacy}
            onChange={(pharmacy) =>
              setDraft((current) => ({ ...current, pharmacy }))
            }
          />
          <Field
            label="Refill date (YYYY-MM-DD, optional)"
            value={draft.refillDueOn}
            onChange={(refillDueOn) =>
              setDraft((current) => ({ ...current, refillDueOn }))
            }
          />

          <Text style={S.h3}>As-needed / PRN?</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {[false, true].map((value) => (
              <View key={String(value)} style={{ flex: 1 }}>
                <Button
                  title={value ? "PRN / as-needed" : "Scheduled / regular"}
                  secondary={draft.isPrn !== value}
                  onPress={() =>
                    setDraft((current) => ({ ...current, isPrn: value }))
                  }
                />
              </View>
            ))}
          </View>

          <Button
            title={busyId === "save" ? "Saving…" : "Save medication"}
            disabled={
              readOnly ||
              busyId !== null ||
              !draft.name.trim() ||
              !draft.instructions.trim()
            }
            onPress={() => void save()}
          />
        </Card>
      )}

      <Section title="Medication reconciliation" />
      <Card style={{ backgroundColor: C.lavender }}>
        <Icon name="git-compare-outline" />
        <Text style={S.h3}>Confirm the current list as a point-in-time snapshot.</Text>
        <Txt>
          Reconciliation helps the next caregiver or transition workflow see
          when the medication list was last reviewed. Confirm it against the
          latest source you trust, such as discharge paperwork, pharmacy labels,
          or the healthcare team.
        </Txt>
        <Field
          label="Reconciliation note (optional)"
          value={reconciliationNote}
          onChange={setReconciliationNote}
          multiline
        />
        <Button
          title={
            busyId === "reconcile"
              ? "Saving reconciliation…"
              : "Reconcile current active list"
          }
          disabled={readOnly || busyId !== null}
          onPress={() => void reconcile()}
        />
      </Card>

      <Section title="Recent medication activity" />
      {records.slice(0, 30).map((record) => {
        const medication = medications.find(
          (item) => item.id === record.medicationId,
        );
        return (
          <Card key={record.id}>
            <Text style={S.eyebrow}>
              {medicationOutcomeLabel(record.status).toUpperCase()}
            </Text>
            <Text style={S.h3}>{medication?.name ?? "Medication"}</Text>
            <Txt style={S.small}>
              {new Date(record.recordedAt).toLocaleString()}
            </Txt>
            {Boolean(record.note) && <Txt>{record.note}</Txt>}
            {record.correctedAt ? (
              <Txt style={S.small}>
                Withdrawn / corrected{" "}
                {new Date(record.correctedAt).toLocaleString()}
              </Txt>
            ) : (
              <Button
                title="Correct / withdraw this record"
                secondary
                disabled={readOnly || busyId !== null}
                onPress={async () => {
                  setBusyId("correct-" + record.id);
                  try {
                    const at = await correctManagedMedicationRecord(
                      careRecipientId,
                      record.id,
                    );
                    dispatch({ type: "correct-med", id: record.id, at });
                    await refresh();
                    setMessage(
                      "Medication record withdrawn. The original entry remains visible for clarity.",
                    );
                  } catch (error) {
                    setMessage(
                      error instanceof Error
                        ? error.message
                        : "We could not correct this medication record.",
                    );
                  } finally {
                    setBusyId(null);
                  }
                }}
              />
            )}
          </Card>
        );
      })}
    </Page>
  );
}
