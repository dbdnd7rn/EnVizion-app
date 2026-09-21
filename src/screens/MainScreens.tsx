import React, { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStack } from "../navigation";
import { useCare } from "../store";
import { loadPublishedGuides, type ClinicalContentRecord } from "../clinicalContent";
import { NotificationBell } from "../notifications";
import {
  Brand,
  Button,
  C,
  Card,
  Fade,
  Heading,
  Icon,
  Landscape,
  Page,
  Row,
  S,
  Safety,
  Section,
  Txt,
} from "../ui";
export const useNav = () =>
  useNavigation<NativeStackNavigationProp<RootStack>>();
export function HomeScreen() {
  const n = useNav();
  const { state } = useCare();
  const logged = state.entries.length > 0;
  const doseRecorded = state.medicationRecords.some((record) => !record.correctedAt);
  const completed = Number(logged) + Number(doseRecorded);
  return (
    <Page>
      <Fade>
        <View style={S.between}>
          <Brand />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Emergency and warning signs"
              onPress={() => n.navigate("Emergency")}
              style={{
                backgroundColor: C.redBg,
                paddingHorizontal: 11,
                minHeight: 43,
                borderRadius: 22,
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Icon name="alert-circle-outline" color={C.rose} size={18} />
              <Text
                style={[
                  S.small,
                  { color: C.rose, fontFamily: "DMSans_600SemiBold" },
                ]}
              >
                Help
              </Text>
            </Pressable>
            <NotificationBell onPress={() => n.navigate("Notifications")} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open your profile"
              onPress={() => n.navigate("Profile")}
              style={{
                width: 43,
                height: 43,
                borderRadius: 22,
                backgroundColor: "#ECE2F1",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={[S.h3, { color: C.purple }]}>
                {state.name.slice(0, 1).toUpperCase()}
              </Text>
            </Pressable>
          </View>
        </View>
        <View style={{ gap: 7 }}>
          <Text style={S.eyebrow}>YOUR CARE COMPANION</Text>
          <Text style={[S.title, { fontFamily: "DMSans_600SemiBold" }]}>
            Welcome, {state.name}.
          </Text>
          <Txt>
            {state.careRecipientName
              ? `${state.careRecipientName} · ${state.accessRole === "owner" ? "Owner" : state.accessRole === "caregiver" ? "Caregiver" : "Viewer"} access`
              : "Your care tools and support, together."}
          </Txt>
        </View>
        <Card
          onPress={() => n.navigate("Assistant")}
          label="Ask EnVizion Assistant"
          style={{
            backgroundColor: "#F0EBF4",
            borderColor: "#DCCEE5",
            gap: 16,
          }}
        >
          <View style={S.between}>
            <View style={S.row}>
              <Icon name="chatbubbles-outline" />
              <Text style={S.h3}>EnVizion Assistant</Text>
            </View>
            <Text style={[S.small, { color: C.purple }]}>Support</Text>
          </View>
          <Text
            style={[S.h2, { fontFamily: "DMSans_600SemiBold", fontSize: 24 }]}
          >
            A question is a good{`\n`}place to start.
          </Text>
          <Txt>
            Find guidance for everyday tasks or bring a person into the
            conversation.
          </Txt>
          <View
            style={[
              S.between,
              { borderRadius: 12, backgroundColor: C.white, padding: 14 },
            ]}
          >
            <Text style={S.body}>How can we help today?</Text>
            <Icon name="arrow-forward" />
          </View>
        </Card>
        <Card
          style={{
            backgroundColor: C.deep,
            borderWidth: 0,
            padding: 0,
            overflow: "hidden",
          }}
        >
          <View style={{ padding: 22, gap: 12 }}>
            <View style={S.between}>
              <Text style={[S.eyebrow, { color: "#E0C6E8" }]}>
                ONE DAY AT A TIME
              </Text>
              <Icon name="sunny-outline" color="#E6CE98" size={24} />
            </View>
            <Text style={[S.h2, { color: C.white, fontSize: 25 }]}>
              Small steps, meaningful care.
            </Text>
            <Txt style={{ color: "#E3D5E9", fontSize: 13 }}>
              Make a little space for today’s check-in.
            </Txt>
            <Pressable
              accessibilityRole="button"
              onPress={() => n.navigate("Tracker", { kind: "Vitals" })}
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 12,
                padding: 13,
                alignSelf: "flex-start",
                flexDirection: "row",
                gap: 20,
              }}
            >
              <Text style={[S.h3, { fontSize: 13, color: C.deep }]}>
                {logged ? "Add another check-in" : "Start daily check-in"}
              </Text>
              <Icon name="arrow-forward" size={18} />
            </Pressable>
          </View>
          <Landscape height={75} />
        </Card>
        <View style={{ gap: 12 }}>
          <Section
            title="Today, together"
            action="My toolkit"
            onPress={() => n.navigate("Main", { screen: "Toolkit" })}
          />
          <View style={S.between}>
            <Txt style={{ fontSize: 12 }}>Your care routine</Txt>
            <Text style={[S.small, { color: C.purple }]}>
              {completed} of 2 complete
            </Text>
          </View>
          <View
            style={{ height: 4, backgroundColor: "#E9E0ED", borderRadius: 4 }}
          >
            <View
              style={{
                height: 4,
                width: `${(completed / 2) * 100}%`,
                backgroundColor: C.purple,
                borderRadius: 4,
              }}
            />
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <QuickCard
              title="Record health"
              subtitle={logged ? "Check-in recorded" : "A moment to check in"}
              icon="pulse-outline"
              onPress={() => n.navigate("Tracker", { kind: "Vitals" })}
            />
            <QuickCard
              title="Medications"
              subtitle={
                doseRecorded
                  ? "Dose record added"
                  : "Keep a simple record"
              }
              icon="medical-outline"
              onPress={() => n.navigate("Medications")}
            />
          </View>
          <Row
            title="Care summary"
            subtitle="Bring your care records together"
            icon="document-text-outline"
            onPress={() => n.navigate("Summary")}
          />
          <Row
            title="Care timeline & insights"
            subtitle="Visual trends, activity, and preparation progress"
            icon="analytics-outline"
            onPress={() => n.navigate("Insights")}
          />
          <Row
            title="Care tasks & shared care plan"
            subtitle="Assign responsibilities, due dates, and follow-ups"
            icon="checkbox-outline"
            onPress={() => n.navigate("CareTasks")}
          />
          <Row
            title="Reminders & care calendar"
            subtitle="Keep alerts and scheduled prompts visible"
            icon="notifications-outline"
            onPress={() => n.navigate("CareCalendar")}
          />
          <Row
            title="Care Document Vault"
            subtitle="Keep important care papers private and close"
            icon="folder-open-outline"
            onPress={() => n.navigate("CareDocuments")}
          />
          <Row
            title="Care contacts & providers"
            subtitle="Doctors, specialists, pharmacy, insurance, and care services"
            icon="call-outline"
            onPress={() => n.navigate("CareContacts")}
          />
          <Row
            title="Care notes & communication log"
            subtitle="Track calls, updates, outcomes, and follow-ups"
            icon="chatbubbles-outline"
            onPress={() => n.navigate("CareCommunicationLog")}
          />
          <Row
            title="Handoff & visit packet"
            subtitle="Create a focused PDF with only the care details you choose"
            icon="reader-outline"
            onPress={() => n.navigate("CarePacket")}
          />
          <Row
            title="Prepare for your next visit"
            subtitle={`${state.appointment.title}${state.appointment.date ? ` · ${state.appointment.date}` : ""} · ${state.questions.length} questions`}
            icon="calendar-outline"
            onPress={() => n.navigate("Appointments")}
          />
        </View>
        <Safety onPress={() => n.navigate("Emergency")} />
        <View style={{ gap: 13 }}>
          <Section title="Support for your journey" />
          <Card
            onPress={() => n.navigate("Transition")}
            label="Walking Through the Transition"
            style={{ padding: 0, overflow: "hidden" }}
          >
            <Landscape height={110} />
            <View style={{ padding: 18, gap: 6 }}>
              <Text style={S.eyebrow}>FROM HOSPITAL TO HOME</Text>
              <Text style={S.h2}>Walking Through{"\n"}the Transition</Text>
              <Txt>A thoughtful next step, at every step.</Txt>
              <Text
                style={[S.h3, { fontSize: 13, color: C.purple, marginTop: 4 }]}
              >
                Explore your homecoming checklist →
              </Text>
            </View>
          </Card>
          <Row
            title="An advocate in your corner"
            subtitle="Explore patient advocate coaching"
            icon="people-outline"
            onPress={() => n.navigate("Coaching")}
          />
        </View>
        {state.faith && (
          <Card style={{ backgroundColor: "#F2EDF5", borderWidth: 0 }}>
            <Icon name="sparkles-outline" />
            <Text style={[S.h2, { fontSize: 21 }]}>You deserve care, too.</Text>
            <Txt>A quiet moment to breathe, reflect, and reconnect.</Txt>
            <Pressable
              accessibilityRole="button"
              onPress={() => n.navigate("Wellness")}
              style={{ paddingVertical: 8 }}
            >
              <Text style={[S.h3, { fontSize: 13, color: C.purple }]}>
                Find a moment of peace →
              </Text>
            </Pressable>
          </Card>
        )}
        <Text style={[S.small, { textAlign: "center" }]}>
          Made with faith, clarity & compassion.{"\n"}Secure care tools • Educational support
        </Text>
      </Fade>
    </Page>
  );
}
function QuickCard({
  title,
  subtitle,
  icon,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: string;
  onPress: () => void;
}) {
  return (
    <Card onPress={onPress} label={title} style={{ flex: 1, padding: 17 }}>
      <Icon name={icon} size={26} />
      <View style={{ gap: 4 }}>
        <Text style={[S.h3, { fontSize: 14 }]}>{title}</Text>
        <Text style={S.small}>{subtitle}</Text>
      </View>
    </Card>
  );
}
export function ToolkitScreen() {
  const n = useNav();
  return (
    <Page>
      <Heading
        eyebrow="ORGANIZE WITH CONFIDENCE"
        title="Your caregiver toolkit"
        body="A little structure for the things that matter most."
      />
      <Safety onPress={() => n.navigate("Emergency")} />
      <Row
        title="Care team & sharing"
        subtitle="Invite family, switch care profiles, and manage access"
        icon="people-outline"
        onPress={() => n.navigate("CareTeam")}
      />
      <Section title="Daily care" />
      <View style={{ gap: 10 }}>
        {(
          [
            "Vitals",
            "Blood sugar",
            "CHF symptoms",
            "Behavior & memory",
            "Red-flag symptoms",
          ] as const
        ).map((kind, i) => (
          <Row
            key={kind}
            title={
              kind === "Behavior & memory"
                ? "Behavior & delirium monitoring"
                : kind
            }
            subtitle={
              [
                "Blood pressure, pulse, and temperature",
                "Record a reading and its context",
                "Weight, breathing, and swelling",
                "Notice changes from their usual self",
                "Keep a record after seeking help",
              ][i]
            }
            icon={
              [
                "pulse-outline",
                "water-outline",
                "heart-outline",
                "flower-outline",
                "flag-outline",
              ][i]
            }
            onPress={() => n.navigate("Tracker", { kind })}
          />
        ))}
      </View>
      <Row
        title="Care summary"
        subtitle="Observations, medicines, and visit questions"
        icon="document-text-outline"
        onPress={() => n.navigate("Summary")}
      />
      <Row
        title="Care timeline & insights"
        subtitle="Visual trends and recent care activity"
        icon="analytics-outline"
        onPress={() => n.navigate("Insights")}
      />
      <Section title="Plan & prepare" />
      <View style={{ gap: 10 }}>
        <Row
          title="Medication logs"
          subtitle="Keep your list and daily record together"
          icon="medical-outline"
          onPress={() => n.navigate("Medications")}
        />
        <Row
          title="Appointment prep"
          subtitle="Bring your questions and observations"
          icon="calendar-outline"
          onPress={() => n.navigate("Appointments")}
        />
        <Row
          title="Care tasks & shared care plan"
          subtitle="Assign responsibilities and track what the care team completes"
          icon="checkbox-outline"
          onPress={() => n.navigate("CareTasks")}
        />
        <Row
          title="Reminders & care calendar"
          subtitle="Shared alerts, appointment prompts, and scheduled reminders"
          icon="notifications-outline"
          onPress={() => n.navigate("CareCalendar")}
        />
        <Row
          title="Care Document Vault"
          subtitle="Private discharge papers, care plans, insurance files, and more"
          icon="folder-open-outline"
          onPress={() => n.navigate("CareDocuments")}
        />
        <Row
          title="Care contacts & providers"
          subtitle="Keep the people and organizations around this care profile together"
          icon="call-outline"
          onPress={() => n.navigate("CareContacts")}
        />
        <Row
          title="Care notes & communication log"
          subtitle="Calls, messages, hospital updates, decisions, and follow-ups"
          icon="chatbubbles-outline"
          onPress={() => n.navigate("CareCommunicationLog")}
        />
        <Row
          title="Handoff & visit packet"
          subtitle="Build a privacy-controlled PDF for a visit or caregiver handoff"
          icon="reader-outline"
          onPress={() => n.navigate("CarePacket")}
        />
        <Row
          title="Walking Through the Transition"
          subtitle="Your hospital-to-home checklist"
          icon="home-outline"
          onPress={() => n.navigate("Transition")}
        />
        <Row
          title="Healthcare navigation"
          subtitle="Understand each specialist’s role"
          icon="compass-outline"
          onPress={() => n.navigate("Specialists")}
        />
      </View>
      <Section title="Understand & advocate" />
      <Row
        title="Patient rights"
        subtitle="Available after EnVizion clinical publication"
        icon="shield-checkmark-outline"
        onPress={() => n.navigate("Guide", { id: "rights" })}
      />
      <Row
        title="Advance directive starter"
        subtitle="Available after EnVizion clinical publication"
        icon="chatbubbles-outline"
        onPress={() => n.navigate("Guide", { id: "advance" })}
      />
    </Page>
  );
}
export function LibraryScreen() {
  const n = useNav();
  const { state } = useCare();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [guides, setGuides] = useState<ClinicalContentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function refresh() {
    setLoading(true);
    setMessage("");
    try {
      setGuides(await loadPublishedGuides());
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not load the published resource library.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const filtered = guides.filter(
    (g) =>
      `${g.title} ${g.category}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (filter !== "Saved" || state.saved.includes(g.id)) &&
      (filter !== "Conditions" || g.category === "Condition guide"),
  );

  return (
    <Page>
      <Heading
        eyebrow="KNOWLEDGE BRINGS CLARITY"
        title="A little more understanding"
        body="Clinically governed resources published by EnVizion Life."
      />

      <View style={[S.input, S.row]}>
        <Icon name="search-outline" size={20} />
        <TextInput
          accessibilityLabel="Search resources"
          placeholder="Search published guides"
          value={query}
          onChangeText={setQuery}
          style={{
            flex: 1,
            fontFamily: "DMSans_400Regular",
            fontSize: 14,
            color: C.ink,
          }}
        />
      </View>

      <View style={S.row}>
        {["All", "Conditions", "Saved"].map((f) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: filter === f }}
            key={f}
            onPress={() => setFilter(f)}
            style={[
              S.pill,
              {
                paddingVertical: 11,
                paddingHorizontal: 18,
                backgroundColor: filter === f ? C.purple : "#F0EBF1",
              },
            ]}
          >
            <Text
              style={[
                S.h3,
                { fontSize: 12, color: filter === f ? C.white : C.muted },
              ]}
            >
              {f}
            </Text>
          </Pressable>
        ))}
      </View>

      {filter === "All" && !query && (
        <Card style={{ backgroundColor: "#F0E8F3" }}>
          <Text style={S.eyebrow}>CLINICALLY GOVERNED LIBRARY</Text>
          <Text style={S.h2}>Published with review behind it.</Text>
          <Txt>
            Only resources that have completed EnVizion Life’s approval and
            publication workflow appear in this library.
          </Txt>
          <Button
            title="Browse trusted resources"
            secondary
            icon="document-text-outline"
            onPress={() => n.navigate("Resources")}
          />
        </Card>
      )}

      {Boolean(message) && (
        <Card style={{ backgroundColor: C.redBg }}>
          <Text accessibilityRole="alert" style={[S.body, { color: C.rose }]}>
            {message}
          </Text>
          <Button title="Try again" secondary onPress={() => void refresh()} />
        </Card>
      )}

      {loading ? (
        <Card>
          <Txt>Loading published resources…</Txt>
        </Card>
      ) : (
        <View style={{ gap: 12 }}>
          {filtered.map((g) => (
            <Row
              key={g.id}
              title={g.title}
              subtitle={`${g.category} · ${g.readTime}`}
              icon={g.icon}
              onPress={() => n.navigate("Guide", { id: g.id })}
            />
          ))}

          {!filtered.length && (
            <Card>
              <Icon name="shield-checkmark-outline" />
              <Text style={S.h3}>
                {filter === "Saved"
                  ? "No saved published guides yet"
                  : "No published guides yet"}
              </Text>
              <Txt>
                {filter === "Saved"
                  ? "Published guides you save will appear here."
                  : "EnVizion Life’s current educational drafts are in clinical review. Approved resources will appear here once published."}
              </Txt>
            </Card>
          )}
        </View>
      )}

      <Row
        title="Trusted resource directory"
        subtitle="Public health resources and EnVizion Life"
        icon="globe-outline"
        onPress={() => n.navigate("Resources")}
      />

      <Text style={S.small}>
        Published guides support conversations with your healthcare team and do
        not replace an individualized care plan.
      </Text>
    </Page>
  );
}
export function SupportScreen() {
  const n = useNav();
  return (
    <Page>
      <Heading
        eyebrow="YOU ARE NOT ALONE"
        title="Care for the caregiver"
        body="Support for the practical, emotional, and spiritual parts of your journey."
      />
      <Row
        title="Ask EnVizion Assistant"
        subtitle="Basic guidance, with a path to a person"
        icon="chatbubbles-outline"
        onPress={() => n.navigate("Assistant")}
      />
      <Row
        title="Your team conversation"
        subtitle="View your latest request or ask for personal support"
        icon="people-outline"
        onPress={() => n.navigate("TeamConversation")}
      />
      <Card style={{ backgroundColor: C.deep, borderWidth: 0 }}>
        <Icon name="people-outline" color="#E5C8ED" size={32} />
        <Text style={[S.h2, { color: C.white }]}>
          An advocate. A listening ear.{"\n"}A clearer next step.
        </Text>
        <Txt style={{ color: "#E9DDED" }}>
          Explore one-on-one and group support with EnVizion Life.
        </Txt>
        <Button
          title="Explore advocate coaching"
          onPress={() => n.navigate("Coaching")}
        />
      </Card>
      <Row
        title="Spiritual Wellness"
        subtitle="Faith, reflection, and room to breathe"
        icon="sparkles-outline"
        onPress={() => n.navigate("Wellness")}
      />
      <Row
        title="Walking Through the Transition"
        subtitle="Feel more prepared for the move home"
        icon="home-outline"
        onPress={() => n.navigate("Transition")}
      />
      <Row
        title="Find your way through healthcare"
        subtitle="Meet the roles on your care team"
        icon="compass-outline"
        onPress={() => n.navigate("Specialists")}
      />
      <Card>
        <Text style={S.eyebrow}>A GENTLE REMINDER</Text>
        <Text style={S.h2}>You can ask for help and still be strong.</Text>
        <Txt>
          Consider one small task you could share with someone you trust today.
        </Txt>
      </Card>
      <Safety onPress={() => n.navigate("Emergency")} />
    </Page>
  );
}
