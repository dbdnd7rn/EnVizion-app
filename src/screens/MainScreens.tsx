import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStack } from "../navigation";
import { useCare } from "../store";
import { guides } from "../content";
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
  const completed = Number(logged) + Number(!!state.meds.morning);
  return (
    <Page>
      <Fade>
        <View style={S.between}>
          <Brand />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Emergency and warning signs"
            onPress={() => n.navigate("Emergency")}
            style={{
              backgroundColor: C.redBg,
              paddingHorizontal: 12,
              minHeight: 44,
              borderRadius: 22,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Icon name="alert-circle-outline" color={C.rose} size={18} />
            <Text
              style={[
                S.small,
                { color: C.rose, fontFamily: "DMSans_600SemiBold" },
              ]}
            >
              Get help
            </Text>
          </Pressable>
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
        <View style={{ gap: 7 }}>
          <Text style={S.eyebrow}>YOUR DAILY DOSE OF SUPPORT</Text>
          <Text style={S.title}>A little clarity.{"\n"}A lot of care.</Text>
          <Txt>Welcome, {state.name}. You don’t have to do this alone.</Txt>
        </View>
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
            <Txt style={{ fontSize: 12 }}>Your sample care routine</Txt>
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
                state.meds.morning
                  ? "Morning log complete"
                  : "Keep a simple record"
              }
              icon="medical-outline"
              onPress={() => n.navigate("Medications")}
            />
          </View>
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
          Made with faith, clarity & compassion.{"\n"}Demo experience • Sample
          data • Educational support
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
        icon="shield-checkmark-outline"
        onPress={() => n.navigate("Guide", { id: "rights" })}
      />
      <Row
        title="Advance directive starter"
        subtitle="Begin a conversation about their wishes"
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
  const filtered = guides.filter(
    (g) =>
      `${g.title} ${g.category}`.toLowerCase().includes(query.toLowerCase()) &&
      (filter !== "Saved" || state.saved.includes(g.id)) &&
      (filter !== "Conditions" || g.category === "Condition guide"),
  );
  return (
    <Page>
      <Heading
        eyebrow="KNOWLEDGE BRINGS CLARITY"
        title="A little more understanding"
        body="Practical guides for the questions along the way."
      />
      <View style={[S.input, S.row]}>
        <Icon name="search-outline" size={20} />
        <TextInput
          accessibilityLabel="Search resources"
          placeholder="Search guides and resources"
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
          <Text style={S.eyebrow}>YOUR PRINTABLE COMPANION</Text>
          <Text style={S.h2}>Good care goes with you.</Text>
          <Txt>
            Read guides here, or print a copy to bring to the next conversation.
          </Txt>
          <Button
            title="Browse trusted resources"
            secondary
            icon="document-text-outline"
            onPress={() => n.navigate("Resources")}
          />
        </Card>
      )}
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
            <Text style={S.h3}>
              {filter === "Saved"
                ? "Your saved guides will live here"
                : "No guides found"}
            </Text>
            <Txt>
              {filter === "Saved"
                ? "Open a guide and tap Save guide to keep it close."
                : "Try a condition name, such as COPD or diabetes."}
            </Txt>
          </Card>
        )}
      </View>
      <Row
        title="Trusted resource directory"
        subtitle="Public health resources and EnVizion Life"
        icon="globe-outline"
        onPress={() => n.navigate("Resources")}
      />
      <Text style={S.small}>
        Educational drafts for clinical review. Guides support conversations
        with your healthcare team.
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
