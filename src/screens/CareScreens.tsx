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
export function TrackerScreen({
  route,
}: NativeStackScreenProps<RootStack, "Tracker">) {
  const { kind } = route.params;
  const { state, dispatch } = useCare();
  const n = useNav();
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const history = state.entries.filter((e) => e.kind === kind);
  return (
    <Page>
      <Heading
        eyebrow="DAILY CARE JOURNAL"
        title={kind}
        body="Notice, record, and share with your healthcare team."
      />
      <Safety onPress={() => n.navigate("Emergency")} />
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
        <Text style={S.eyebrow}>NEW OBSERVATION • DEMO</Text>
        {trackerFields[kind].map((f) => (
          <Field
            key={f.key}
            label={f.label + (f.required ? " *" : "")}
            value={values[f.key] || ""}
            numeric={f.numeric}
            onChange={(v) => {
              setValues((old) => ({ ...old, [f.key]: v }));
              setSuccess(false);
            }}
          />
        ))}
        <Field
          label="Additional notes (optional)"
          value={values.notes || ""}
          onChange={(v) => setValues((old) => ({ ...old, notes: v }))}
          multiline
        />
        {Boolean(error) && (
          <Text accessibilityRole="alert" style={{ color: C.rose }}>
            {error}
          </Text>
        )}
        {success && (
          <Text accessibilityRole="alert" style={[S.h3, { color: C.green }]}>
            Observation saved to this demo session.
          </Text>
        )}
        <Button
          title="Save observation"
          icon="checkmark-outline"
          onPress={() => {
            const message = validateEntry(kind, values);
            if (message) {
              setError(message);
              return;
            }
            dispatch({
              type: "entry",
              entry: {
                id: `${Date.now()}-${Math.random()}`,
                kind,
                values: { ...values },
                recordedAt: new Date().toISOString(),
              },
            });
            setValues({});
            setError("");
            setSuccess(true);
          }}
        />
        <Text style={S.small}>
          * Required. This demo keeps entries only while the app is open. Use
          sample information.
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
        history.map((e) => (
          <Card key={e.id}>
            <Text style={S.eyebrow}>
              {new Date(e.recordedAt).toLocaleString()}
            </Text>
            {trackerFields[kind]
              .filter((f) => e.values[f.key])
              .map((f) => (
                <View key={f.key}>
                  <Text style={S.small}>{f.label}</Text>
                  <Text style={S.h3}>{e.values[f.key]}</Text>
                </View>
              ))}
            {Boolean(e.values.notes) && <Txt>{e.values.notes}</Txt>}
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
  const closeForm = () => {
    setAdding(false);
    setEditingId(null);
    setName("");
    setInstructions("");
    setTime("");
  };
  const activeRecords = state.medicationRecords.filter((r) => !r.correctedAt);
  return (
    <Page>
      <Heading
        eyebrow="DAILY CARE"
        title="A clearer medication routine"
        body="Keep your list, record each dose, and bring your notes to the care team."
      />
      <Card style={{ backgroundColor: C.lavender }}>
        <Text style={S.eyebrow}>YOUR DEMO SESSION</Text>
        <Text style={S.h2}>{activeRecords.length} doses recorded</Text>
        <Txt>
          Use sample information. Times show when you made each entry, not a
          verified administration time. Reloading clears this demo.
        </Txt>
      </Card>
      <Section title="Your medication list" />
      {state.medications.map((medication) => (
        <Card key={medication.id}>
          <View style={S.row}>
            <Icon name="medical-outline" />
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={S.h3}>{medication.name}</Text>
              <Text style={S.small}>Scheduled: {medication.time}</Text>
            </View>
          </View>
          <Txt>{medication.instructions}</Txt>
          <Button
            title={"Record dose: " + medication.name}
            icon="checkmark-circle-outline"
            onPress={() => {
              dispatch({
                type: "record-med",
                record: {
                  id: String(Date.now()) + Math.random(),
                  medication: { ...medication },
                  recordedAt: new Date().toISOString(),
                },
              });
              setMessage(
                medication.name +
                  ": recorded as taken. You can correct this entry in session history.",
              );
            }}
          />
          <Button
            title={"Edit " + medication.name}
            secondary
            icon="create-outline"
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
        title={adding ? "Cancel medication changes" : "Add sample medication"}
        secondary
        icon={adding ? "close-outline" : "add-outline"}
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
            Copy the label for this demo. Editing your list never changes
            earlier records or your prescribed care plan.
          </Txt>
          <Button
            title={
              editingId ? "Save medication details" : "Add to my medication log"
            }
            disabled={!name.trim() || !instructions.trim() || !time.trim()}
            onPress={() => {
              const medication = {
                id: editingId || String(Date.now()) + Math.random(),
                name: name.trim(),
                instructions: instructions.trim(),
                time: time.trim(),
              };
              dispatch({
                type: editingId ? "edit-med" : "add-med",
                medication,
              });
              closeForm();
              setMessage("Medication list updated for this demo session.");
            }}
          />
        </Card>
      )}
      {Boolean(message) && (
        <Text accessibilityRole="alert" style={S.body}>
          {message}
        </Text>
      )}
      <Section title="Session history" />
      {!state.medicationRecords.length && (
        <Card>
          <Icon name="journal-outline" />
          <Text style={S.h3}>Your record starts here.</Text>
          <Txt>
            Record a sample dose above. Each entry will appear with its own
            timestamp.
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
              onPress={() => {
                dispatch({
                  type: "correct-med",
                  id: record.id,
                  at: new Date().toISOString(),
                });
                setMessage(
                  "Entry withdrawn. The original record remains visible in history.",
                );
              }}
            />
          )}
        </Card>
      ))}
      <Button
        title="Print medication list and history"
        icon="print-outline"
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
        These are session records, not reminders or dose recommendations. Follow
        the pharmacy label and ask a pharmacist or clinician about medication
        questions.
      </Text>
    </Page>
  );
}
export function AppointmentScreen() {
  const { state, dispatch } = useCare();
  const [question, setQuestion] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(state.appointment);
  const [error, setError] = useState("");
  return (
    <Page>
      <Heading
        eyebrow="MAKE ROOM FOR YOUR QUESTIONS"
        title="Walk in feeling prepared"
        body="Keep the important things together for your next appointment."
      />
      <Card style={{ backgroundColor: C.lavender }}>
        <View style={S.row}>
          <Icon name="calendar-outline" size={28} />
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={S.eyebrow}>YOUR NEXT VISIT • DEMO</Text>
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
          onPress={() => {
            setDraft(state.appointment);
            setError("");
            setEditing(!editing);
          }}
        />
      </Card>
      {editing && (
        <Card>
          <Field
            label="Visit title"
            value={draft.title}
            onChange={(title) => setDraft((d) => ({ ...d, title }))}
          />
          <Field
            label="Date (YYYY-MM-DD, optional)"
            value={draft.date}
            onChange={(date) => setDraft((d) => ({ ...d, date }))}
          />
          <Field
            label="Time (HH:MM, 24-hour, optional)"
            value={draft.time}
            onChange={(time) => setDraft((d) => ({ ...d, time }))}
          />
          <Field
            label="Location or joining details (optional)"
            value={draft.location}
            onChange={(location) => setDraft((d) => ({ ...d, location }))}
          />
          <Field
            label="Preparation notes (optional)"
            value={draft.notes}
            onChange={(notes) => setDraft((d) => ({ ...d, notes }))}
            multiline
          />
          {Boolean(error) && (
            <Text accessibilityRole="alert" style={[S.body, { color: C.rose }]}>
              {error}
            </Text>
          )}
          <Button
            title="Save visit details"
            onPress={() => {
              const appointment = {
                title: draft.title.trim(),
                date: draft.date.trim(),
                time: draft.time.trim(),
                location: draft.location.trim(),
                notes: draft.notes.trim(),
              };
              const error = validateAppointment(appointment);
              if (error) {
                setError(error);
                return;
              }
              dispatch({ type: "appointment", appointment });
              setEditing(false);
              setError("");
              setMessage("Visit details saved for this demo session.");
            }}
          />
        </Card>
      )}
      <Section title="Questions to bring" />
      {state.questions.map((q, i) => (
        <Card key={`${i}-${q}`} style={{ flexDirection: "row", gap: 14 }}>
          <Text style={[S.h3, { color: C.purple }]}>
            {String(i + 1).padStart(2, "0")}
          </Text>
          <Txt style={{ flex: 1, color: C.ink }}>{q}</Txt>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove question ${i + 1}`}
            onPress={() => dispatch({ type: "remove-question", index: i })}
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
      <Field
        label="What else would you like to ask?"
        value={question}
        onChange={setQuestion}
        multiline
      />
      <Button
        title="Add my question"
        disabled={!question.trim()}
        icon="add-outline"
        secondary
        onPress={() => {
          dispatch({ type: "question", text: question.trim() });
          setQuestion("");
        }}
      />
      <Button
        title="Print or save appointment sheet"
        icon="print-outline"
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
  return (
    <Page>
      <Heading
        eyebrow="FROM HOSPITAL TO HOME"
        title="Walking Through the Transition"
        body="You don’t need to remember everything. Take it one step at a time."
      />
      <Card style={{ backgroundColor: C.lavender }}>
        <Text style={S.h2}>{state.transition.length} of 6 steps prepared</Text>
        <View
          style={{ height: 6, backgroundColor: "#DDCDE6", borderRadius: 4 }}
        >
          <View
            style={{
              height: 6,
              width: `${(state.transition.length / 6) * 100}%`,
              backgroundColor: C.purple,
              borderRadius: 4,
            }}
          />
        </View>
        <Txt>
          Use this checklist alongside your discharge team’s instructions.
        </Txt>
      </Card>
      {transitionSteps.map((step, i) => (
        <Pressable
          key={step}
          accessibilityRole="checkbox"
          accessibilityLabel={step}
          accessibilityState={{ checked: state.transition.includes(i) }}
          onPress={() => dispatch({ type: "transition", index: i })}
          style={[S.card, S.row, { padding: 17 }]}
        >
          <Icon
            name={
              state.transition.includes(i)
                ? "checkmark-circle"
                : "ellipse-outline"
            }
            color={state.transition.includes(i) ? C.green : C.purple}
          />
          <Text style={[S.body, { flex: 1, color: C.ink }]}>{step}</Text>
        </Pressable>
      ))}
      <Button
        title="Print my transition checklist"
        icon="print-outline"
        onPress={async () => {
          try {
            await printResource(
              "Walking Through the Transition",
              transitionSteps.map(
                (s, i) =>
                  `${state.transition.includes(i) ? "[Done]" : "[  ]"} ${s}`,
              ),
            );
          } catch {
            setMessage("Unable to open printing. Please try again.");
          }
        }}
      />
      {Boolean(message) && <Txt>{message}</Txt>}
      <Safety onPress={() => n.navigate("Emergency")} />
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
