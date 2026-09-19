import React, { useState } from "react";
import { Text, View } from "react-native";
import { useCare } from "../store";
import { careSummaryLines, observationLines } from "../summary";
import { printResource } from "../printing";
import { Button, Card, C, Heading, Page, Row, S, Section, Txt } from "../ui";
import { useNav } from "./MainScreens";

export function SummaryScreen() {
  const { state } = useCare();
  const n = useNav();
  const [message, setMessage] = useState("");
  const [printing, setPrinting] = useState(false);
  const doses = state.medicationRecords.filter(
    (record) => !record.correctedAt,
  ).length;
  return (
    <Page>
      <Heading
        eyebrow="READY FOR THE CONVERSATION"
        title="Your care, in one place"
        body="Bring the details you have recorded to your next care conversation."
      />
      <Card style={{ backgroundColor: C.lavender }}>
        <Text style={S.eyebrow}>THIS DEMO SESSION</Text>
        <View style={{ gap: 8 }}>
          <Text style={S.h3}>{state.entries.length} observations recorded</Text>
          <Text style={S.h3}>{doses} dose entries recorded as taken</Text>
          <Text style={S.h3}>{state.questions.length} questions prepared</Text>
        </View>
        <Txt>
          Caregiver-entered information, without clinical interpretation. This
          summary includes this session only and clears when you reload.
        </Txt>
      </Card>
      <Button
        title={printing ? "Preparing summary…" : "Print or save care summary"}
        icon="print-outline"
        disabled={printing}
        onPress={async () => {
          setPrinting(true);
          setMessage("");
          try {
            await printResource(
              "My care conversation summary",
              careSummaryLines(state),
            );
            setMessage(
              "Print or share requested. Check the window on your browser or device.",
            );
          } catch {
            setMessage(
              "The print window could not open. Please try again on a supported browser or device.",
            );
          } finally {
            setPrinting(false);
          }
        }}
      />
      {Boolean(message) && (
        <Text accessibilityRole="alert" style={S.body}>
          {message}
        </Text>
      )}
      <Section title="Next visit" />
      <Row
        title={state.appointment.title}
        subtitle={[
          state.appointment.date || "Date to be confirmed",
          state.appointment.time,
          state.appointment.location,
        ]
          .filter(Boolean)
          .join(" · ")}
        icon="calendar-outline"
        onPress={() => n.navigate("Appointments")}
      />
      {Boolean(state.appointment.notes) && <Txt>{state.appointment.notes}</Txt>}
      <Section title="Questions to bring" />
      <Card>
        {state.questions.length ? (
          state.questions.map((question, index) => (
            <Txt key={index}>
              {index + 1}. {question}
            </Txt>
          ))
        ) : (
          <Txt>No questions added yet.</Txt>
        )}
      </Card>
      <Section title="Recorded observations" />
      {state.entries.length ? (
        state.entries.map((entry) => (
          <Card key={entry.id}>
            {observationLines(entry).map((line, index) => (
              <Text key={index} style={index === 0 ? S.h3 : S.body}>
                {line}
              </Text>
            ))}
          </Card>
        ))
      ) : (
        <Card>
          <Text style={S.h3}>A fresh page for your care notes</Text>
          <Txt>Your saved tracker entries will appear here.</Txt>
        </Card>
      )}
      <Button
        title="Add an observation"
        secondary
        onPress={() => n.navigate("Main", { screen: "Toolkit" })}
      />
      <Section title="Medication list" />
      {state.medications.map((medication) => (
        <Card key={medication.id}>
          <Text style={S.h3}>{medication.name}</Text>
          <Txt>{medication.instructions}</Txt>
          <Text style={S.small}>Scheduled: {medication.time}</Text>
        </Card>
      ))}
      <Row
        title="Review medication history"
        subtitle="View timestamps and withdrawn entries"
        icon="journal-outline"
        onPress={() => n.navigate("Medications")}
      />
      <Txt style={S.small}>
        The printable summary also includes medication history and corrections.
        Review all details with your healthcare team; this is not a complete
        medical record.
      </Txt>
    </Page>
  );
}
