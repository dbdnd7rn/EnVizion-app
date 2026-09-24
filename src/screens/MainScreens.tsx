import React, { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStack } from "../navigation";
import { useCare } from "../store";
import { loadPublishedGuides, type ClinicalContentRecord } from "../clinicalContent";
import { NotificationBell } from "../notifications";
import { FamilyCareDashboard } from "../components/FamilyCareDashboard";
import { CareSyncBanner } from "../components/CareSyncBanner";
import {
  loadToolPreferences,
  rankToolTitles,
  recordToolUse,
  togglePinnedTool,
  withRecordedUse,
  withToggledPin,
  type ToolPreferences,
} from "../toolPreferences";
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
  const smartNext =
    !state.careRecipientId
      ? {
          title: "Set up shared care",
          body: "Create or join a care profile so schedules, tasks, records, and family updates stay connected.",
          icon: "people-outline",
          onPress: () => n.navigate("CareTeam"),
        }
      : !logged
        ? {
            title: "Start today’s check-in",
            body: "Record the observations you already have so the rest of the care team can see today’s picture.",
            icon: "pulse-outline",
            onPress: () => n.navigate("Tracker", { kind: "Vitals" }),
          }
        : state.accessRole === "caregiver"
          ? {
              title: "See what needs you today",
              body: "Open the shift board for assigned work, handoffs, overdue items, and shared responsibilities.",
              icon: "people-outline",
              onPress: () => n.navigate("CareShiftBoard"),
            }
          : state.accessRole === "owner"
            ? {
                title: "Review today’s coordination",
                body: "Check conflicts, uncovered work, and follow-ups that may need an owner decision.",
                icon: "sparkles-outline",
                onPress: () => n.navigate("CareCoordinationInbox"),
              }
            : {
                title: "Review the care summary",
                body: "See the latest care information in one place without changing shared records.",
                icon: "document-text-outline",
                onPress: () => n.navigate("Summary"),
              };
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
        <CareSyncBanner />

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
          onPress={() => smartNext.onPress()}
          label={smartNext.title}
          style={{
            backgroundColor: "#F6F0F8",
            borderColor: "#E2D7E8",
            padding: 18,
            gap: 12,
          }}
        >
          <View style={S.between}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  backgroundColor: C.white,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name={smartNext.icon} size={21} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={S.eyebrow}>SMART NEXT STEP</Text>
                <Text style={S.h3}>{smartNext.title}</Text>
              </View>
            </View>
            <Icon name="arrow-forward" size={18} />
          </View>
          <Txt>{smartNext.body}</Txt>
        </Card>

        <FamilyCareDashboard
          careRecipientId={state.careRecipientId}
          careRecipientName={state.careRecipientName}
          accessRole={state.accessRole}
          medicationRecords={state.medicationRecords}
          onOpenSchedule={() => n.navigate("CareSchedule")}
          onOpenAppointments={() => n.navigate("Appointments")}
          onOpenTasks={() => n.navigate("CareTasks")}
          onOpenMedications={() => n.navigate("Medications")}
          onOpenCommunications={() => n.navigate("CareCommunicationLog")}
          onOpenCoordination={() => n.navigate("CareCoordinationInbox")}
          onOpenCarePlan={() => n.navigate("CarePlan")}
          onOpenDocuments={() => n.navigate("CareDocuments")}
          onOpenFamilyCommunication={() => n.navigate("FamilyCommunication")}
          onOpenTransition={() => n.navigate("Transition")}
          onOpenEmergency={() => n.navigate("Emergency")}
        />

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
            title="Quick actions"
            action="All tools"
            onPress={() => n.navigate("Main", { screen: "Toolkit" })}
          />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <QuickCard
              title="Care plan"
              subtitle="See what matters today"
              icon="list-outline"
              onPress={() => n.navigate("CarePlan")}
            />
            <QuickCard
              title="Check-in"
              subtitle={logged ? "Add another record" : "Record health"}
              icon="pulse-outline"
              onPress={() => n.navigate("Tracker", { kind: "Vitals" })}
            />
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <QuickCard
              title="Medications"
              subtitle={doseRecorded ? "Record updated" : "Open medication log"}
              icon="medical-outline"
              onPress={() => n.navigate("Medications")}
            />
            <QuickCard
              title="Calendar"
              subtitle="Visits, tasks & shifts"
              icon="calendar-outline"
              onPress={() => n.navigate("CareCalendar")}
            />
          </View>
          <Row
            title="Find any care tool"
            subtitle="Search the full toolkit by what you need to do"
            icon="search-outline"
            onPress={() => n.navigate("Main", { screen: "Toolkit" })}
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
type ToolItem = {
  title: string;
  subtitle: string;
  icon: string;
  keywords?: string;
  onPress: () => void;
};

function ToolItemRow({
  item,
  pinned,
  onOpen,
  onTogglePin,
}: {
  item: ToolItem;
  pinned: boolean;
  onOpen: (item: ToolItem) => void;
  onTogglePin: (title: string) => void;
}) {
  return (
    <View
      style={[
        S.card,
        {
          padding: 0,
          flexDirection: "row",
          alignItems: "stretch",
          overflow: "hidden",
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.title}. ${item.subtitle}`}
        accessibilityHint="Open this care tool"
        onPress={() => onOpen(item)}
        style={({ pressed }) => ({
          flex: 1,
          minHeight: 76,
          padding: 15,
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          opacity: pressed ? 0.72 : 1,
        })}
      >
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 13,
            backgroundColor: C.lavender,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={item.icon} size={21} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={S.h3}>{item.title}</Text>
          <Text style={S.small}>{item.subtitle}</Text>
        </View>
        <Icon name="chevron-forward" color="#A092A6" size={17} />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={pinned ? `Unpin ${item.title}` : `Pin ${item.title}`}
        accessibilityState={{ selected: pinned }}
        onPress={() => onTogglePin(item.title)}
        style={({ pressed }) => ({
          width: 50,
          alignItems: "center",
          justifyContent: "center",
          borderLeftWidth: 1,
          borderLeftColor: C.line,
          backgroundColor: pinned ? "#F7F1F9" : C.white,
          opacity: pressed ? 0.65 : 1,
        })}
      >
        <Icon
          name={pinned ? "star" : "star-outline"}
          color={pinned ? C.purple : C.muted}
          size={20}
        />
      </Pressable>
    </View>
  );
}

function ToolGroup({
  title,
  subtitle,
  icon,
  items,
  preferences,
  onOpenTool,
  onTogglePin,
  defaultOpen = false,
}: {
  title: string;
  subtitle: string;
  icon: string;
  items: ToolItem[];
  preferences: ToolPreferences;
  onOpenTool: (item: ToolItem) => void;
  onTogglePin: (title: string) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View style={{ gap: 10 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}. ${subtitle}`}
        onPress={() => setOpen((value) => !value)}
        style={({ pressed }) => [
          S.card,
          {
            padding: 16,
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
            backgroundColor: open ? "#F7F1F9" : C.white,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: C.lavender,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={icon} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={S.h3}>{title}</Text>
          <Text style={S.small}>{subtitle}</Text>
        </View>
        <View
          style={{
            minWidth: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: C.white,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={open ? "chevron-up" : "chevron-down"} size={17} />
        </View>
      </Pressable>

      {open && (
        <Fade>
          <View style={{ gap: 10, paddingLeft: 6 }}>
            {items.map((item) => (
              <ToolItemRow
                key={item.title}
                item={item}
                pinned={preferences.pinned.includes(item.title)}
                onOpen={onOpenTool}
                onTogglePin={onTogglePin}
              />
            ))}
          </View>
        </Fade>
      )}
    </View>
  );
}

export function ToolkitScreen() {
  const n = useNav();
  const [query, setQuery] = useState("");
  const [preferences, setPreferences] = useState<ToolPreferences>({
    pinned: [],
    recent: [],
    usage: {},
  });

  useEffect(() => {
    let active = true;
    loadToolPreferences().then((saved) => {
      if (active) setPreferences(saved);
    });
    return () => {
      active = false;
    };
  }, []);

  const groups: Array<{
    title: string;
    subtitle: string;
    icon: string;
    items: ToolItem[];
  }> = [
    {
      title: "Daily care",
      subtitle: "Check-ins, observations, summaries, and trends",
      icon: "pulse-outline",
      items: [
        {
          title: "Vitals",
          subtitle: "Blood pressure, pulse, and temperature",
          icon: "pulse-outline",
          keywords: "health check in blood pressure temperature",
          onPress: () => n.navigate("Tracker", { kind: "Vitals" }),
        },
        {
          title: "Blood sugar",
          subtitle: "Record a reading and its context",
          icon: "water-outline",
          keywords: "glucose diabetes health check in",
          onPress: () => n.navigate("Tracker", { kind: "Blood sugar" }),
        },
        {
          title: "CHF symptoms",
          subtitle: "Weight, breathing, and swelling",
          icon: "heart-outline",
          keywords: "heart failure breathing swelling weight",
          onPress: () => n.navigate("Tracker", { kind: "CHF symptoms" }),
        },
        {
          title: "Behavior & delirium monitoring",
          subtitle: "Notice changes from their usual self",
          icon: "flower-outline",
          keywords: "memory behavior confusion delirium",
          onPress: () => n.navigate("Tracker", { kind: "Behavior & memory" }),
        },
        {
          title: "Red-flag symptoms",
          subtitle: "Keep a record after seeking help",
          icon: "flag-outline",
          keywords: "warning red flag symptoms urgent",
          onPress: () => n.navigate("Tracker", { kind: "Red-flag symptoms" }),
        },
        {
          title: "Care summary",
          subtitle: "Observations, medicines, and visit questions",
          icon: "document-text-outline",
          keywords: "summary overview records",
          onPress: () => n.navigate("Summary"),
        },
        {
          title: "Care timeline & insights",
          subtitle: "Visual trends and recent care activity",
          icon: "analytics-outline",
          keywords: "timeline trends charts insights history",
          onPress: () => n.navigate("Insights"),
        },
      ],
    },
    {
      title: "Plan & prepare",
      subtitle: "Routines, medicines, appointments, documents, and transitions",
      icon: "calendar-outline",
      items: [
        {
          title: "Daily care plan & routines",
          subtitle: "Meals, medications, mobility, hygiene, monitoring, and everyday care",
          icon: "list-outline",
          keywords: "routine daily plan meals mobility hygiene",
          onPress: () => n.navigate("CarePlan"),
        },
        {
          title: "Medication management",
          subtitle: "Medication list, PRN records, refills, and reconciliation",
          icon: "medical-outline",
          keywords: "medicine medication refill prn dose",
          onPress: () => n.navigate("Medications"),
        },
        {
          title: "Appointment prep",
          subtitle: "Bring your questions and observations",
          icon: "calendar-outline",
          keywords: "visit doctor appointment questions",
          onPress: () => n.navigate("Appointments"),
        },
        {
          title: "Care Document Vault",
          subtitle: "Private discharge papers, care plans, insurance files, and more",
          icon: "folder-open-outline",
          keywords: "documents files discharge insurance papers",
          onPress: () => n.navigate("CareDocuments"),
        },
        {
          title: "Care contacts & providers",
          subtitle: "Keep the people and organizations around this care profile together",
          icon: "call-outline",
          keywords: "doctor provider pharmacy insurance phone contacts",
          onPress: () => n.navigate("CareContacts"),
        },
        {
          title: "Care packet & printable summary",
          subtitle: "Build privacy-controlled visit, handoff, and emergency PDFs",
          icon: "reader-outline",
          keywords: "packet pdf print summary handoff",
          onPress: () => n.navigate("CarePacket"),
        },
        {
          title: "Hospital-to-home transition",
          subtitle: "Discharge plan, equipment, warning signs, and follow-ups",
          icon: "home-outline",
          keywords: "hospital home discharge transition",
          onPress: () => n.navigate("Transition"),
        },
        {
          title: "Emergency Information Center",
          subtitle: "Quick contacts, key records, medication reconciliation, and preparedness",
          icon: "alert-circle-outline",
          keywords: "emergency urgent warning safety",
          onPress: () => n.navigate("Emergency"),
        },
      ],
    },
    {
      title: "Care team & coordination",
      subtitle: "People, schedules, tasks, coverage, communication, and handoffs",
      icon: "people-outline",
      items: [
        {
          title: "Care team & sharing",
          subtitle: "Invite family, switch care profiles, and manage access",
          icon: "people-outline",
          keywords: "family invite access roles team share",
          onPress: () => n.navigate("CareTeam"),
        },
        {
          title: "Today & caregiver shift board",
          subtitle: "Coverage, due work, reassignment, and shift handoffs",
          icon: "people-outline",
          keywords: "today shift board handoff caregiver",
          onPress: () => n.navigate("CareShiftBoard"),
        },
        {
          title: "On-shift caregiver mode",
          subtitle: "My work, shared work, notes, care context, and shift closeout",
          icon: "pulse-outline",
          keywords: "shift caregiver work takeover closeout",
          onPress: () => n.navigate("OnShiftCaregiver"),
        },
        {
          title: "Live care team & continuity",
          subtitle: "Current caregiver, next shift, coverage bridge, and handoff history",
          icon: "git-compare-outline",
          keywords: "continuity current caregiver handoff next shift",
          onPress: () => n.navigate("CareContinuity"),
        },
        {
          title: "Recurring care coverage",
          subtitle: "Define repeatable times when caregiver coverage is required",
          icon: "time-outline",
          keywords: "recurring coverage requirement schedule",
          onPress: () => n.navigate("CareCoverageRequirements"),
        },
        {
          title: "Weekly coverage approval",
          subtitle: "Review the week, publish assignments, and track caregiver responses",
          icon: "checkmark-done-outline",
          keywords: "weekly approval publish assignment response deadline",
          onPress: () => n.navigate("WeeklyCoveragePlan"),
        },
        {
          title: "Smart Coverage Planner",
          subtitle: "Scan the next 7 days, match caregivers, and review coverage suggestions",
          icon: "sparkles-outline",
          keywords: "smart planner match caregiver suggestions coverage",
          onPress: () => n.navigate("SmartCoveragePlanner"),
        },
        {
          title: "Open caregiver coverage",
          subtitle: "Request help for an uncovered window or claim available coverage",
          icon: "megaphone-outline",
          keywords: "open coverage uncovered request claim backup",
          onPress: () => n.navigate("CareCoverageRequests"),
        },
        {
          title: "Caregiver availability & schedule",
          subtitle: "Plan shifts, check-ins, attendance, swaps, and uncovered responsibilities",
          icon: "calendar-outline",
          keywords: "availability schedule shifts swap attendance",
          onPress: () => n.navigate("CareSchedule"),
        },
        {
          title: "Care coordination analytics",
          subtitle: "Weekly workload, attendance, tasks, and coverage trends",
          icon: "bar-chart-outline",
          keywords: "analytics workload coverage attendance trends",
          onPress: () => n.navigate("CareAnalytics"),
        },
        {
          title: "Needs coordination",
          subtitle: "Overlaps, uncovered work, appointment clashes, and long care days",
          icon: "warning-outline",
          keywords: "conflicts inbox coordination overlap uncovered",
          onPress: () => n.navigate("CareCoordinationInbox"),
        },
        {
          title: "Care tasks & shared care plan",
          subtitle: "Assign responsibilities and track what the care team completes",
          icon: "checkbox-outline",
          keywords: "tasks assign responsibilities follow up",
          onPress: () => n.navigate("CareTasks"),
        },
        {
          title: "Family care calendar & agenda",
          subtitle: "One day and week view across the shared care plan",
          icon: "notifications-outline",
          keywords: "calendar agenda day week reminder",
          onPress: () => n.navigate("CareCalendar"),
        },
        {
          title: "Family communication center",
          subtitle: "Share family care updates and track acknowledgements",
          icon: "chatbubbles-outline",
          keywords: "family communication updates acknowledgement",
          onPress: () => n.navigate("FamilyCommunication"),
        },
        {
          title: "Provider & insurance communication",
          subtitle: "Calls, portal messages, decisions, and follow-ups",
          icon: "document-text-outline",
          keywords: "provider insurance calls messages portal follow up",
          onPress: () => n.navigate("CareCommunicationLog"),
        },
      ],
    },
    {
      title: "Understand & advocate",
      subtitle: "Healthcare navigation and clinically governed guidance",
      icon: "shield-checkmark-outline",
      items: [
        {
          title: "Healthcare navigation",
          subtitle: "Understand each specialist’s role",
          icon: "compass-outline",
          keywords: "specialists healthcare navigation doctors",
          onPress: () => n.navigate("Specialists"),
        },
        {
          title: "Patient rights",
          subtitle: "Available after EnVizion clinical publication",
          icon: "shield-checkmark-outline",
          keywords: "rights advocacy patient",
          onPress: () => n.navigate("Guide", { id: "rights" }),
        },
        {
          title: "Advance directive starter",
          subtitle: "Available after EnVizion clinical publication",
          icon: "chatbubbles-outline",
          keywords: "advance directive wishes planning advocate",
          onPress: () => n.navigate("Guide", { id: "advance" }),
        },
      ],
    },
  ];

  const allItems = groups.flatMap((group) => group.items);

  function openTool(item: ToolItem) {
    const next = withRecordedUse(preferences, item.title);
    setPreferences(next);
    void recordToolUse(preferences, item.title);
    item.onPress();
  }

  function togglePin(title: string) {
    const next = withToggledPin(preferences, title);
    setPreferences(next);
    void togglePinnedTool(preferences, title);
  }

  const personalizedItems = rankToolTitles(preferences)
    .map((title) => allItems.find((item) => item.title === title))
    .filter((item): item is ToolItem => Boolean(item))
    .slice(0, 4);

  const normalizedQuery = query.trim().toLowerCase();
  const matches = groups.flatMap((group) =>
    group.items.filter((item) =>
      `${item.title} ${item.subtitle} ${item.keywords || ""}`
        .toLowerCase()
        .includes(normalizedQuery),
    ),
  );

  return (
    <Page>
      <Fade>
        <Heading
          eyebrow="FIND WHAT YOU NEED"
          title="Care tools, without the clutter"
          body="Search by what you want to do, open a category, or pin the tools you use most. Every existing care feature is still here."
        />

        <View style={[S.input, S.row]}>
          <Icon name="search-outline" size={20} />
          <TextInput
            accessibilityLabel="Search care tools"
            placeholder="Try “medication”, “coverage”, “documents”…"
            placeholderTextColor="#AAA0AF"
            value={query}
            onChangeText={setQuery}
            style={{
              flex: 1,
              fontFamily: "DMSans_400Regular",
              fontSize: 14,
              color: C.ink,
            }}
          />
          {Boolean(query) && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear tool search"
              onPress={() => setQuery("")}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="close" size={18} color={C.muted} />
            </Pressable>
          )}
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <QuickCard
            title="Today"
            subtitle="Tasks & handoffs"
            icon="checkbox-outline"
            onPress={() => {
              const item = allItems.find(
                (tool) => tool.title === "Today & caregiver shift board",
              );
              if (item) openTool(item);
            }}
          />
          <QuickCard
            title="Calendar"
            subtitle="Visits & shifts"
            icon="calendar-outline"
            onPress={() => {
              const item = allItems.find(
                (tool) => tool.title === "Family care calendar & agenda",
              );
              if (item) openTool(item);
            }}
          />
        </View>

        <Safety onPress={() => n.navigate("Emergency")} />

        {normalizedQuery ? (
          <View style={{ gap: 10 }}>
            <Section title={`${matches.length} matching ${matches.length === 1 ? "tool" : "tools"}`} />
            {matches.map((item) => (
              <ToolItemRow
                key={item.title}
                item={item}
                pinned={preferences.pinned.includes(item.title)}
                onOpen={openTool}
                onTogglePin={togglePin}
              />
            ))}
            {!matches.length && (
              <Card>
                <Icon name="search-outline" />
                <Text style={S.h3}>No tool matched that search.</Text>
                <Txt>
                  Try a task word such as medication, documents, coverage,
                  calendar, family, appointment, or emergency.
                </Txt>
              </Card>
            )}
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            {personalizedItems.length > 0 && (
              <View style={{ gap: 10 }}>
                <Section
                  title={
                    preferences.pinned.length
                      ? "Your shortcuts"
                      : "Recently used"
                  }
                />
                <Txt style={S.small}>
                  {preferences.pinned.length
                    ? "Pinned tools stay here. Recent tools help fill the remaining spots."
                    : "This area learns from the tools you open most often."}
                </Txt>
                {personalizedItems.map((item) => (
                  <ToolItemRow
                    key={`personal-${item.title}`}
                    item={item}
                    pinned={preferences.pinned.includes(item.title)}
                    onOpen={openTool}
                    onTogglePin={togglePin}
                  />
                ))}
              </View>
            )}

            <Section title="All care tools" />

            {groups.map((group, index) => (
              <ToolGroup
                key={group.title}
                title={group.title}
                subtitle={group.subtitle}
                icon={group.icon}
                items={group.items}
                preferences={preferences}
                onOpenTool={openTool}
                onTogglePin={togglePin}
                defaultOpen={index === 0 && personalizedItems.length === 0}
              />
            ))}
          </View>
        )}
      </Fade>
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
