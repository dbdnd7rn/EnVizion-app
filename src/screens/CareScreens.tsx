import React, { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStack } from "../navigation";
import { useCare } from "../store";
import { trackerFields, validateEntry } from "../domain";
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
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [time, setTime] = useState("");
  return (
    <Page>
      <Heading
        eyebrow="DAILY CARE"
        title="A clearer medication routine"
        body="Record what happened. Keep the conversation with your care team informed."
      />
      <Card style={{ backgroundColor: "#F1EBF5" }}>
        <Text style={S.h3}>A sample routine, just for exploring</Text>
        <Txt>
          These are example labels, not prescriptions or dose instructions. You
          can add a sample medication below to explore the log.
        </Txt>
      </Card>
      {state.medications.map(
        ({ id, name: title, time, instructions: desc }) => (
          <Card key={id}>
            <View style={S.between}>
              <View style={S.row}>
                <Icon name="medical-outline" />
                <Text style={S.h3}>{title}</Text>
              </View>
              <Text style={S.small}>{time}</Text>
            </View>
            <Txt>{desc}</Txt>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: !!state.meds[id] }}
              accessibilityLabel={`Mark ${title} as taken`}
              onPress={() => dispatch({ type: "med", id })}
              style={{
                borderRadius: 12,
                padding: 15,
                backgroundColor: state.meds[id] ? "#E9F2EC" : C.lavender,
                flexDirection: "row",
                gap: 10,
              }}
            >
              <Icon
                name={state.meds[id] ? "checkmark-circle" : "ellipse-outline"}
                color={state.meds[id] ? C.green : C.purple}
              />
              <Text style={S.h3}>
                {state.meds[id] ? "Recorded as taken" : "Mark as taken"}
              </Text>
            </Pressable>
          </Card>
        ),
      )}
      <Button
        title={adding ? "Cancel adding medication" : "Add sample medication"}
        secondary
        icon="add-outline"
        onPress={() => setAdding(!adding)}
      />
      {adding && (
        <Card>
          <Field label="Medication name" value={name} onChange={setName} />
          <Field
            label="Directions exactly as prescribed"
            value={instructions}
            onChange={setInstructions}
          />
          <Field label="Scheduled time" value={time} onChange={setTime} />
          <Button
            title="Add to my medication log"
            disabled={!name.trim() || !instructions.trim() || !time.trim()}
            onPress={() => {
              dispatch({
                type: "add-med",
                medication: {
                  id: String(Date.now()),
                  name: name.trim(),
                  instructions: instructions.trim(),
                  time: time.trim(),
                },
              });
              setName("");
              setInstructions("");
              setTime("");
              setAdding(false);
            }}
          />
        </Card>
      )}
      <Text style={S.small}>
        Check-offs are demo session records, not reminders or dose
        recommendations. Ask a pharmacist or clinician about missed doses or
        medication questions.
      </Text>
    </Page>
  );
}
export function AppointmentScreen() {
  const { state, dispatch } = useCare();
  const [question, setQuestion] = useState("");
  const [message, setMessage] = useState("");
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
          <View>
            <Text style={S.eyebrow}>SAMPLE APPOINTMENT</Text>
            <Text style={S.h3}>Primary care follow-up</Text>
            <Txt>Bring your discharge papers and care notes.</Txt>
          </View>
        </View>
      </Card>
      <Section title="Questions to bring" />
      {state.questions.map((q, i) => (
        <Card key={`${i}-${q}`} style={{ flexDirection: "row", gap: 14 }}>
          <Text style={[S.h3, { color: C.purple }]}>
            {String(i + 1).padStart(2, "0")}
          </Text>
          <Txt style={{ flex: 1, color: C.ink }}>{q}</Txt>
        </Card>
      ))}
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
            await printResource("My appointment questions", state.questions);
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
