import React, { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStack } from "../navigation";
import { useCare } from "../store";
import {
  appointmentLines,
  trackerFields,
  validateAppointment,
  validateEntry,
} from "../domain";
import {
  Button,
  C,
  Card,
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
import { transitionSteps } from "../content";
import { useNav } from "./MainScreens";
import { printResource } from "../printing";
import { medicationLines } from "../medications";
import { addAppointmentToDeviceCalendar } from "../deviceCalendar";
import {
  addAppointmentQuestion,
  correctMedicationDose,
  createMedication,
  recordMedicationDose,
  removeAppointmentQuestion,
  saveAppointment,
  saveObservation,
  setTransitionItem,
  updateMedication,
} from "../backend";


function ReadOnlyCareNotice() {
  return (
    <Card style={{ backgroundColor: C.lavender }}>
      <Icon name="eye-outline" />
      <Text style={S.h3}>Viewer access is read-only.</Text>
      <Txt>
        You can review the shared care record, but only the Owner or a Caregiver
        can make changes.
      </Txt>
    </Card>
  );
}

export function TrackerScreen({
  route,
}: NativeStackScreenProps<RootStack, "Tracker">) {
  const { kind } = route.params;
  const { state, dispatch } = useCare();
  const n = useNav();
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const readOnly = state.accessRole === "viewer";
  const history = state.entries.filter((e) => e.kind === kind);

  async function save() {
    const validationMessage = validateEntry(kind, values);
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setSaving(true);
    setError("");
    try {
      const entry = await saveObservation(kind, values);
      dispatch({ type: "entry", entry });
      setValues({});
      setSuccess(true);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "We could not save this observation. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page>
      <Heading
        eyebrow="DAILY CARE JOURNAL"
        title={kind}
        body="Notice, record, and share with your healthcare team."
      />
      <Safety onPress={() => n.navigate("Emergency")} />
      {readOnly && <ReadOnlyCareNotice />}
      {(kind === "Red-flag symptoms" || kind === "Behavior & memory") && (
        <Card style={{ backgroundColor: C.redBg }}>
          <Text style={[S.h3, { color: C.rose }]}>
            Getting help comes before logging.
          </Text>
          <Txt>
            For sudden confusion or a concerning change, seek prompt medical
            help. For a possible emergency, call your local emergency number. Do
            not wait to complete this form.
          </Txt>
        </Card>
      )}
      <Card>
        <Text style={S.eyebrow}>NEW OBSERVATION</Text>
        {trackerFields[kind].map((field) => (
          <Field
            key={field.key}
            label={field.label + (field.required ? " *" : "")}
            value={values[field.key] || ""}
            numeric={field.numeric}
            onChange={(value) => {
              setValues((old) => ({ ...old, [field.key]: value }));
              setSuccess(false);
            }}
          />
        ))}
        <Field
          label="Additional notes (optional)"
          value={values.notes || ""}
          onChange={(value) =>
            setValues((old) => ({ ...old, notes: value }))
          }
          multiline
        />
        {Boolean(error) && (
          <Text accessibilityRole="alert" style={{ color: C.rose }}>
            {error}
          </Text>
        )}
        {success && (
          <Text accessibilityRole="alert" style={[S.h3, { color: C.green }]}>
            Observation saved securely.
          </Text>
        )}
        <Button
          title={
            readOnly
              ? "Viewer access — read only"
              : saving
                ? "Saving observation…"
                : "Save observation"
          }
          icon="checkmark-outline"
          disabled={saving || readOnly}
          onPress={() => void save()}
        />
        <Text style={S.small}>
          * Required. Readings are stored with your account and are not
          interpreted as a diagnosis.
        </Text>
      </Card>

      <Section title="Your recent observations" />
      {!history.length ? (
        <Card>
          <Icon name="journal-outline" />
          <Text style={S.h3}>A fresh page for today.</Text>
          <Txt>
            Your saved observations will appear here. No readings have been
            added yet.
          </Txt>
        </Card>
      ) : (
        history.map((entry) => (
          <Card key={entry.id}>
            <Text style={S.eyebrow}>
              {new Date(entry.recordedAt).toLocaleString()}
            </Text>
            {trackerFields[kind]
              .filter((field) => entry.values[field.key])
              .map((field) => (
                <View key={field.key}>
                  <Text style={S.small}>{field.label}</Text>
                  <Text style={S.h3}>{entry.values[field.key]}</Text>
                </View>
              ))}
            {Boolean(entry.values.notes) && <Txt>{entry.values.notes}</Txt>}
          </Card>
        ))
      )}
      <Txt style={S.small}>
        Readings are recorded without diagnostic interpretation. Follow the
        individual care plan provided by the healthcare team.
      </Txt>
    </Page>
  );
}

export function MedicationScreen() {
  const { state, dispatch } = useCare();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [time, setTime] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const readOnly = state.accessRole === "viewer";

  const closeForm = () => {
    setAdding(false);
    setEditingId(null);
    setName("");
    setInstructions("");
    setTime("");
  };

  const activeRecords = state.medicationRecords.filter(
    (record) => !record.correctedAt,
  );

  async function saveMedicationDetails() {
    setMessage("");
    setBusyId(editingId ?? "new");
    try {
      const medication = editingId
        ? await updateMedication({
            id: editingId,
            name: name.trim(),
            instructions: instructions.trim(),
            time: time.trim(),
          })
        : await createMedication({
            name: name.trim(),
            instructions: instructions.trim(),
            time: time.trim(),
          });

      dispatch({
        type: editingId ? "edit-med" : "add-med",
        medication,
      });
      closeForm();
      setMessage("Medication list updated securely.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not update the medication list.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Page>
      <Heading
        eyebrow="DAILY CARE"
        title="A clearer medication routine"
        body="Keep your list, record each dose, and bring your notes to the care team."
      />
      {readOnly && <ReadOnlyCareNotice />}
      <Card style={{ backgroundColor: C.lavender }}>
        <Text style={S.eyebrow}>YOUR MEDICATION RECORD</Text>
        <Text style={S.h2}>{activeRecords.length} active dose records</Text>
        <Txt>
          Times show when you recorded each entry. This caregiver log does not
          change the prescribed medication plan.
        </Txt>
      </Card>

      <Section title="Your medication list" />
      {!state.medications.length && (
        <Card>
          <Icon name="medical-outline" />
          <Text style={S.h3}>No medications added yet.</Text>
          <Txt>
            Add medications from the pharmacy label so your caregiver record is
            ready when you need it.
          </Txt>
        </Card>
      )}

      {state.medications.map((medication) => (
        <Card key={medication.id}>
          <View style={S.row}>
            <Icon name="medical-outline" />
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={S.h3}>{medication.name}</Text>
              <Text style={S.small}>
                Scheduled: {medication.time || "Not specified"}
              </Text>
            </View>
          </View>
          <Txt>{medication.instructions}</Txt>
          <Button
            title={
              busyId === `dose-${medication.id}`
                ? "Recording dose…"
                : "Record dose: " + medication.name
            }
            icon="checkmark-circle-outline"
            disabled={busyId !== null || readOnly}
            onPress={async () => {
              setBusyId(`dose-${medication.id}`);
              setMessage("");
              try {
                const record = await recordMedicationDose(medication);
                dispatch({ type: "record-med", record });
                setMessage(
                  medication.name +
                    ": recorded as taken. You can correct this entry below.",
                );
              } catch (error) {
                setMessage(
                  error instanceof Error
                    ? error.message
                    : "We could not record this dose.",
                );
              } finally {
                setBusyId(null);
              }
            }}
          />
          <Button
            title={"Edit " + medication.name}
            secondary
            icon="create-outline"
            disabled={busyId !== null || readOnly}
            onPress={() => {
              setEditingId(medication.id);
              setAdding(true);
              setName(medication.name);
              setInstructions(medication.instructions);
              setTime(medication.time);
              setMessage("");
            }}
          />
        </Card>
      ))}

      <Button
        title={adding ? "Cancel medication changes" : "Add medication"}
        secondary
        icon={adding ? "close-outline" : "add-outline"}
        disabled={busyId !== null || readOnly}
        onPress={() => {
          if (adding) closeForm();
          else {
            closeForm();
            setAdding(true);
          }
        }}
      />

      {adding && (
        <Card>
          <Text style={S.h3}>
            {editingId ? "Edit medication details" : "Add to your list"}
          </Text>
          <Field label="Medication name" value={name} onChange={setName} />
          <Field
            label="Directions exactly as prescribed"
            value={instructions}
            onChange={setInstructions}
            multiline
          />
          <Field label="Scheduled time" value={time} onChange={setTime} />
          <Txt style={S.small}>
            Copy the pharmacy label carefully. This record is for organization;
            it does not alter the prescription.
          </Txt>
          <Button
            title={
              busyId
                ? "Saving medication…"
                : editingId
                  ? "Save medication details"
                  : "Add to my medication log"
            }
            disabled={
              busyId !== null ||
              readOnly ||
              !name.trim() ||
              !instructions.trim() ||
              !time.trim()
            }
            onPress={() => void saveMedicationDetails()}
          />
        </Card>
      )}

      {Boolean(message) && (
        <Text accessibilityRole="alert" style={S.body}>
          {message}
        </Text>
      )}

      <Section title="Medication history" />
      {!state.medicationRecords.length && (
        <Card>
          <Icon name="journal-outline" />
          <Text style={S.h3}>Your record starts here.</Text>
          <Txt>
            Dose records will appear here with the time they were entered.
          </Txt>
        </Card>
      )}

      {state.medicationRecords.map((record) => (
        <Card key={record.id}>
          <Text
            style={[
              S.eyebrow,
              { color: record.correctedAt ? C.muted : C.green },
            ]}
          >
            {record.correctedAt ? "CORRECTED / WITHDRAWN" : "RECORDED AS TAKEN"}
          </Text>
          <Text style={S.h3}>{record.medication.name}</Text>
          <Txt>{record.medication.instructions}</Txt>
          <Text style={S.small}>
            Entry recorded: {new Date(record.recordedAt).toLocaleString()}
          </Text>
          {record.correctedAt ? (
            <Text style={S.small}>
              Withdrawn: {new Date(record.correctedAt).toLocaleString()}. Kept
              here for clarity.
            </Text>
          ) : (
            <Button
              title={"Correct entry for " + record.medication.name}
              secondary
              disabled={busyId !== null || readOnly}
              onPress={async () => {
                setBusyId(`correct-${record.id}`);
                setMessage("");
                try {
                  const at = await correctMedicationDose(record.id);
                  dispatch({ type: "correct-med", id: record.id, at });
                  setMessage(
                    "Entry withdrawn. The original record remains visible in history.",
                  );
                } catch (error) {
                  setMessage(
                    error instanceof Error
                      ? error.message
                      : "We could not correct this record.",
                  );
                } finally {
                  setBusyId(null);
                }
              }}
            />
          )}
        </Card>
      ))}

      <Button
        title="Print medication list and history"
        icon="print-outline"
        disabled={readOnly}
        onPress={async () => {
          try {
            await printResource(
              "My medication record",
              medicationLines(state.medications, state.medicationRecords),
            );
            setMessage(
              "Print or share requested. Check your browser or device window.",
            );
          } catch {
            setMessage(
              "Printing could not open. Please try again on a supported browser or device.",
            );
          }
        }}
      />
      <Text style={S.small}>
        These are caregiver records, not reminders or dose recommendations.
        Follow the pharmacy label and ask a pharmacist or clinician about
        medication questions.
      </Text>
    </Page>
  );
}

export function AppointmentScreen() {
  const { state, dispatch } = useCare();
  const n = useNav();
  const [question, setQuestion] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(state.appointment);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const readOnly = state.accessRole === "viewer";

  async function saveVisit() {
    const appointment = {
      title: draft.title.trim(),
      date: draft.date.trim(),
      time: draft.time.trim(),
      location: draft.location.trim(),
      notes: draft.notes.trim(),
    };

    const validationError = validateAppointment(appointment);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");
    try {
      const appointmentId = await saveAppointment(
        appointment,
        state.appointmentId,
      );
      dispatch({ type: "appointment", appointment, appointmentId });
      setEditing(false);
      setMessage("Visit details saved securely.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "We could not save the visit details.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page>
      <Heading
        eyebrow="MAKE ROOM FOR YOUR QUESTIONS"
        title="Walk in feeling prepared"
        body="Keep the important things together for your next appointment."
      />
      {readOnly && <ReadOnlyCareNotice />}
      <Card style={{ backgroundColor: C.lavender }}>
        <View style={S.row}>
          <Icon name="calendar-outline" size={28} />
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={S.eyebrow}>YOUR NEXT VISIT</Text>
            <Text style={S.h3}>{state.appointment.title}</Text>
            <Txt>
              {state.appointment.date || "Date to be confirmed"}
              {state.appointment.time ? ` · ${state.appointment.time}` : ""}
            </Txt>
            {Boolean(state.appointment.location) && (
              <Txt>{state.appointment.location}</Txt>
            )}
            {Boolean(state.appointment.notes) && (
              <Txt>{state.appointment.notes}</Txt>
            )}
          </View>
        </View>
        <Button
          title={editing ? "Cancel editing visit" : "Edit visit details"}
          secondary
          icon="create-outline"
          disabled={saving || readOnly}
          onPress={() => {
            setDraft(state.appointment);
            setError("");
            setEditing(!editing);
          }}
        />
        <Button
          title="Add visit to device calendar"
          secondary
          icon="calendar-outline"
          disabled={saving || !state.appointment.date}
          onPress={async () => {
            setMessage("");
            try {
              await addAppointmentToDeviceCalendar(state.appointment);
              setMessage("Calendar window opened.");
            } catch (calendarError) {
              setMessage(
                calendarError instanceof Error
                  ? calendarError.message
                  : "We could not open the device calendar.",
              );
            }
          }}
        />
      </Card>

      {editing && (
        <Card>
          <Field
            label="Visit title"
            value={draft.title}
            onChange={(title) => setDraft((item) => ({ ...item, title }))}
          />
          <Field
            label="Date (YYYY-MM-DD, optional)"
            value={draft.date}
            onChange={(date) => setDraft((item) => ({ ...item, date }))}
          />
          <Field
            label="Time (HH:MM, 24-hour, optional)"
            value={draft.time}
            onChange={(time) => setDraft((item) => ({ ...item, time }))}
          />
          <Field
            label="Location or joining details (optional)"
            value={draft.location}
            onChange={(location) =>
              setDraft((item) => ({ ...item, location }))
            }
          />
          <Field
            label="Preparation notes (optional)"
            value={draft.notes}
            onChange={(notes) => setDraft((item) => ({ ...item, notes }))}
            multiline
          />
          {Boolean(error) && (
            <Text accessibilityRole="alert" style={[S.body, { color: C.rose }]}>
              {error}
            </Text>
          )}
          <Button
            title={saving ? "Saving visit…" : "Save visit details"}
            disabled={saving}
            onPress={() => void saveVisit()}
          />
        </Card>
      )}

      <Section title="Questions to bring" />
      {state.questions.map((item, index) => (
        <Card key={state.questionIds[index] || `${index}-${item}`} style={{ flexDirection: "row", gap: 14 }}>
          <Text style={[S.h3, { color: C.purple }]}>
            {String(index + 1).padStart(2, "0")}
          </Text>
          <Txt style={{ flex: 1, color: C.ink }}>{item}</Txt>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove question ${index + 1}`}
            disabled={saving || readOnly}
            onPress={async () => {
              const questionId = state.questionIds[index];
              if (!questionId) {
                dispatch({ type: "remove-question", index });
                return;
              }

              setSaving(true);
              try {
                await removeAppointmentQuestion(questionId);
                dispatch({ type: "remove-question", index });
              } catch (removeError) {
                setMessage(
                  removeError instanceof Error
                    ? removeError.message
                    : "We could not remove that question.",
                );
              } finally {
                setSaving(false);
              }
            }}
            style={{
              minWidth: 44,
              minHeight: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="close-circle-outline" color={C.muted} />
          </Pressable>
        </Card>
      ))}

      {state.questions.length === 0 && (
        <Card>
          <Txt>
            Your question list is clear. Add anything you want to remember
            below.
          </Txt>
        </Card>
      )}

      {!readOnly && (
        <>
          <Field
            label="What else would you like to ask?"
            value={question}
            onChange={setQuestion}
            multiline
          />
          <Button
            title={saving ? "Saving question…" : "Add my question"}
            disabled={!question.trim() || saving}
            icon="add-outline"
            secondary
            onPress={async () => {
              setSaving(true);
              setMessage("");
              try {
                const result = await addAppointmentQuestion({
                  appointment: state.appointment,
                  appointmentId: state.appointmentId,
                  question: question.trim(),
                  position: state.questions.length,
                });
                dispatch({
                  type: "question",
                  text: question.trim(),
                  id: result.questionId,
                  appointmentId: result.appointmentId,
                });
                setQuestion("");
              } catch (addError) {
                setMessage(
                  addError instanceof Error
                    ? addError.message
                    : "We could not save that question.",
                );
              } finally {
                setSaving(false);
              }
            }}
          />
        </>
      )}

      <Button
        title="Print or save appointment sheet"
        icon="print-outline"
        disabled={readOnly}
        onPress={async () => {
          try {
            await printResource(
              "My appointment plan",
              appointmentLines(state.appointment, state.questions),
            );
            setMessage("Your print or share window has opened.");
          } catch {
            setMessage(
              "Printing could not open. Please try again on a supported browser or device.",
            );
          }
        }}
      />
      <Button
        title="Build a focused visit packet"
        secondary
        icon="reader-outline"
        disabled={readOnly}
        onPress={() => n.navigate("CarePacket")}
      />
      {Boolean(message) && <Txt>{message}</Txt>}
      <Card>
        <Text style={S.h3}>Before you leave</Text>
        <Txt>
          Ask who to contact with follow-up questions, and repeat the next steps
          in your own words to check your understanding.
        </Txt>
      </Card>
    </Page>
  );
}

export function TransitionScreen() {
  const { state, dispatch } = useCare();
  const n = useNav();
  const [message, setMessage] = useState("");
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const readOnly = state.accessRole === "viewer";

  return (
    <Page>
      <Heading
        eyebrow="FROM HOSPITAL TO HOME"
        title="Walking Through the Transition"
        body="You don’t need to remember everything. Take it one step at a time."
      />
      {readOnly && <ReadOnlyCareNotice />}
      <Card style={{ backgroundColor: C.lavender }}>
        <Text style={S.h2}>
          {state.transition.length} of {transitionSteps.length} steps prepared
        </Text>
        <View
          style={{ height: 6, backgroundColor: "#DDCDE6", borderRadius: 4 }}
        >
          <View
            style={{
              height: 6,
              width: `${(state.transition.length / transitionSteps.length) * 100}%`,
              backgroundColor: C.purple,
              borderRadius: 4,
            }}
          />
        </View>
        <Txt>
          Use this checklist alongside your discharge team’s instructions.
        </Txt>
      </Card>

      {transitionSteps.map((step, index) => {
        const completed = state.transition.includes(index);
        return (
          <Pressable
            key={step}
            accessibilityRole="checkbox"
            accessibilityLabel={step}
            accessibilityState={{ checked: completed }}
            disabled={savingIndex !== null || readOnly}
            onPress={async () => {
              setSavingIndex(index);
              setMessage("");
              try {
                await setTransitionItem(index, !completed);
                dispatch({ type: "transition", index });
              } catch (error) {
                setMessage(
                  error instanceof Error
                    ? error.message
                    : "We could not update the checklist.",
                );
              } finally {
                setSavingIndex(null);
              }
            }}
            style={[S.card, S.row, { padding: 17 }]}
          >
            <Icon
              name={completed ? "checkmark-circle" : "ellipse-outline"}
              color={completed ? C.green : C.muted}
            />
            <Text style={[S.body, { flex: 1, color: C.ink }]}>{step}</Text>
          </Pressable>
        );
      })}

      {Boolean(message) && <Txt>{message}</Txt>}

      <Card style={{ backgroundColor: C.redBg }}>
        <Text style={[S.h3, { color: C.rose }]}>
          Know who to call before you leave.
        </Text>
        <Txt>
          Ask the discharge team which symptoms need urgent help and which
          number to call after hours.
        </Txt>
        <Button
          title="Review warning signs"
          secondary
          onPress={() => n.navigate("Emergency")}
        />
      </Card>
    </Page>
  );
}

export function EmergencyScreen() {
  const [message, setMessage] = useState("");
  return (
    <Page>
      <Heading
        eyebrow="URGENT SUPPORT"
        title="Emergency & warning signs"
        body="If you think someone may be having a medical emergency, call emergency services now."
      />
      <Card style={{ backgroundColor: C.redBg, borderColor: "#EAC9C9" }}>
        <Icon name="alert-circle" color={C.rose} size={34} />
        <Text style={[S.h2, { color: "#963845" }]}>
          Do not wait for the app.
        </Text>
        <Txt>
          Call your local emergency number for severe trouble breathing, chest
          pain, unresponsiveness, or possible stroke. This list is not
          exhaustive.
        </Txt>
        <Button
          title="Call 911 (United States)"
          icon="call-outline"
          onPress={async () => {
            try {
              await Linking.openURL("tel:911");
            } catch {
              setMessage(
                "Use your phone to dial 911 in the United States, or your local emergency number.",
              );
            }
          }}
        />
        <Txt style={S.small}>
          Outside the United States, use your local emergency number. The app
          does not monitor entries or contact help automatically.
        </Txt>
        {Boolean(message) && (
          <Text accessibilityRole="alert" style={S.h3}>
            {message}
          </Text>
        )}
      </Card>
      <Section title="Know the signs of stroke" />
      <Txt>
        Sudden changes in any of the following can be warning signs. Call
        emergency services even if symptoms go away.
      </Txt>
      {[
        ["B", "Balance", "Sudden loss of balance or trouble walking"],
        ["E", "Eyes", "Sudden trouble seeing"],
        ["F", "Face", "Sudden facial weakness or drooping"],
        ["A", "Arms", "Sudden arm weakness, especially on one side"],
        ["S", "Speech", "Sudden trouble speaking or understanding"],
        ["T", "Time", "Call emergency services. Note when symptoms began."],
      ].map(([letter, title, body]) => (
        <View key={letter} style={S.row}>
          <View
            style={{
              width: 43,
              height: 43,
              borderRadius: 13,
              backgroundColor: C.redBg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={[S.h2, { color: C.rose }]}>{letter}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={S.h3}>{title}</Text>
            <Txt>{body}</Txt>
          </View>
        </View>
      ))}
      <Row
        title="Read CDC stroke guidance"
        subtitle="Source: Centers for Disease Control and Prevention"
        icon="open-outline"
        onPress={() =>
          Linking.openURL(
            "https://www.cdc.gov/stroke/signs-symptoms/index.html",
          ).catch(() =>
            setMessage("Could not open the source. Please try again."),
          )
        }
      />
      <Txt style={S.small}>
        Educational guidance, not a complete assessment. Follow dispatcher
        instructions and the care plan from your healthcare team.
      </Txt>
    </Page>
  );
}
