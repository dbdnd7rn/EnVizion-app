import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import {
  loadCareContinuityData,
  type CareContinuityData,
} from "../careContinuity";
import {
  buildCareContinuityTimeline,
  continuityEventCounts,
  continuityKindLabel,
  type CareContinuityEvent,
  type CareContinuityEventKind,
} from "../careContinuityHelpers";
import {
  presenceModeLabel,
  presenceScreenLabel,
} from "../carePresence";
import { useCarePresence } from "../CarePresenceProvider";
import {
  loadCareTeam,
  type CareTeamRoster,
} from "../careTeam";
import { supabase } from "../supabase";
import { useCare } from "../store";
import {
  Button,
  C,
  Card,
  Heading,
  Icon,
  Page,
  S,
  Section,
  Txt,
} from "../ui";
import { useNav } from "./MainScreens";

type TimelineFilter = "all" | "handoffs" | "shifts" | "notes";

const emptyData: CareContinuityData = {
  sessions: [],
  notes: [],
  handoffs: [],
  acknowledgements: [],
  attendance: [],
};

function eventIcon(kind: CareContinuityEventKind) {
  if (kind === "session_started") return "play-circle-outline";
  if (kind === "session_ended") return "stop-circle-outline";
  if (kind === "shift_note") return "create-outline";
  if (kind === "handoff_created") return "swap-horizontal-outline";
  if (kind === "handoff_acknowledged") return "checkmark-done-outline";
  if (kind === "attendance_checkin") return "log-in-outline";
  return "log-out-outline";
}

function eventMatchesFilter(
  event: CareContinuityEvent,
  filter: TimelineFilter,
) {
  if (filter === "all") return true;
  if (filter === "notes") return event.kind === "shift_note";
  if (filter === "handoffs") {
    return (
      event.kind === "handoff_created" ||
      event.kind === "handoff_acknowledged"
    );
  }
  return (
    event.kind === "session_started" ||
    event.kind === "session_ended" ||
    event.kind === "attendance_checkin" ||
    event.kind === "attendance_checkout"
  );
}

export function CareContinuityScreen() {
  const n = useNav();
  const { state } = useCare();
  const { livePresence, setActivity } = useCarePresence();
  const careRecipientId = state.careRecipientId;

  const [data, setData] = useState<CareContinuityData>(emptyData);
  const [roster, setRoster] = useState<CareTeamRoster | null>(null);
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    if (!careRecipientId) {
      setData(emptyData);
      setRoster(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const [continuity, team] = await Promise.all([
        loadCareContinuityData(careRecipientId),
        loadCareTeam(careRecipientId),
      ]);
      setData(continuity);
      setRoster(team);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not load care continuity.",
      );
    } finally {
      setLoading(false);
    }
  }, [careRecipientId]);

  useEffect(() => {
    setActivity({
      mode: "coordination",
      screenKey: "continuity",
      sessionId: null,
    });

    return () => {
      setActivity({
        mode: "workspace",
        screenKey: "care_workspace",
        sessionId: null,
      });
    };
  }, [setActivity]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!careRecipientId) return;

    const tables = [
      "caregiver_shift_sessions",
      "caregiver_shift_session_notes",
      "care_shift_handoffs",
      "care_shift_handoff_acknowledgements",
      "care_shift_attendance",
      "care_recipient_members",
    ];

    let channel = supabase.channel("care-continuity:" + careRecipientId);
    for (const table of tables) {
      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: "care_recipient_id=eq." + careRecipientId,
        },
        () => void refresh(),
      );
    }
    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [careRecipientId, refresh]);

  const members = useMemo(
    () => roster?.members.filter((member) => member.status === "active") ?? [],
    [roster],
  );

  const memberMap = useMemo(
    () => new Map(members.map((member) => [member.userId, member])),
    [members],
  );

  function memberName(userId: string | null) {
    if (!userId) return "Care team";
    const member = memberMap.get(userId);
    if (!member) return "Caregiver";
    return member.isCurrentUser
      ? (member.displayName || "Me") + " (me)"
      : member.displayName || "Caregiver";
  }

  const events = useMemo(
    () => buildCareContinuityTimeline(data),
    [data],
  );

  const counts = useMemo(() => continuityEventCounts(events), [events]);

  const filteredEvents = useMemo(
    () => events.filter((event) => eventMatchesFilter(event, filter)).slice(0, 100),
    [events, filter],
  );

  const activeSessions = useMemo(
    () => data.sessions.filter((session) => !session.endedAt),
    [data.sessions],
  );

  const activeAttendance = useMemo(
    () => data.attendance.filter((item) => item.status === "active"),
    [data.attendance],
  );

  const acknowledgementByHandoff = useMemo(
    () =>
      new Map(
        data.acknowledgements.map((acknowledgement) => [
          acknowledgement.handoffId,
          acknowledgement,
        ]),
      ),
    [data.acknowledgements],
  );

  const pendingTakeovers = useMemo(
    () =>
      data.handoffs.filter(
        (handoff) =>
          handoff.requiresAcknowledgement &&
          !acknowledgementByHandoff.has(handoff.id),
      ),
    [acknowledgementByHandoff, data.handoffs],
  );

  const visiblePresence = useMemo(
    () =>
      [...livePresence].sort((a, b) => {
        if (a.mode === "on_shift" && b.mode !== "on_shift") return -1;
        if (a.mode !== "on_shift" && b.mode === "on_shift") return 1;
        return new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime();
      }),
    [livePresence],
  );

  if (!careRecipientId) {
    return (
      <Page>
        <Heading
          eyebrow="CARE TEAM CONTINUITY"
          title="Choose a care profile first."
          body="Live workspace presence and continuity history belong to one shared care profile."
        />
      </Page>
    );
  }

  return (
    <Page>
      <Heading
        eyebrow="LIVE CARE TEAM & CONTINUITY"
        title="See who is in the care workspace and what changed between shifts."
        body="Live EnVizion workspace presence sits alongside durable handoffs, shift sessions, notes, and attendance history."
      />

      {Boolean(message) && (
        <Card>
          <Text accessibilityRole="alert" style={S.body}>
            {message}
          </Text>
        </Card>
      )}

      <Section
        title="In EnVizion now"
        action="Refresh"
        onPress={() => void refresh()}
      />

      {visiblePresence.length ? (
        visiblePresence.map((item) => {
          const member = memberMap.get(item.userId);
          const onShift = item.mode === "on_shift";
          return (
            <Card
              key={item.userId}
              style={{
                borderColor: onShift ? "#B8D8C6" : C.line,
                backgroundColor: onShift ? "#F4FBF7" : C.white,
              }}
            >
              <View style={S.between}>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={S.row}>
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: C.green,
                      }}
                    />
                    <Text style={S.h3}>{memberName(item.userId)}</Text>
                  </View>
                  <Txt style={S.small}>
                    {presenceScreenLabel(item.screenKey)} ·{" "}
                    {new Date(item.lastSeenAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Txt>
                  {member && (
                    <Txt style={S.small}>
                      {member.role === "owner"
                        ? "Care owner"
                        : member.role === "caregiver"
                          ? "Caregiver"
                          : "Viewer"}
                    </Txt>
                  )}
                </View>
                <View
                  style={[
                    S.pill,
                    {
                      backgroundColor: onShift ? "#E3F3EA" : C.lavender,
                    },
                  ]}
                >
                  <Text
                    style={[
                      S.small,
                      { color: onShift ? C.green : C.deep },
                    ]}
                  >
                    {presenceModeLabel(item.mode)}
                  </Text>
                </View>
              </View>
            </Card>
          );
        })
      ) : (
        <Card>
          <Icon name="people-outline" size={28} />
          <Text style={S.h3}>No other recent workspace presence.</Text>
          <Txt>
            Care-team members appear here while their EnVizion app is actively
            connected to this care profile.
          </Txt>
        </Card>
      )}

      <Card style={{ backgroundColor: C.lavender }}>
        <Icon name="information-circle-outline" />
        <Text style={S.h3}>Online is not the same as physically present.</Text>
        <Txt>
          This shows recent EnVizion workspace activity only. Scheduled-shift
          check-in and attendance records are shown separately below and still
          do not provide emergency monitoring or location verification.
        </Txt>
      </Card>

      <Section title="Continuity now" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <Card style={{ flex: 1, minWidth: 145 }}>
          <Text style={S.eyebrow}>ON-SHIFT SESSIONS</Text>
          <Text style={S.h2}>{activeSessions.length}</Text>
          <Txt style={S.small}>Active takeover-backed sessions</Txt>
        </Card>
        <Card style={{ flex: 1, minWidth: 145 }}>
          <Text style={S.eyebrow}>CHECKED IN</Text>
          <Text style={S.h2}>{activeAttendance.length}</Text>
          <Txt style={S.small}>Active scheduled attendance records</Txt>
        </Card>
        <Card style={{ flex: 1, minWidth: 145 }}>
          <Text style={S.eyebrow}>PENDING TAKEOVERS</Text>
          <Text style={S.h2}>{pendingTakeovers.length}</Text>
          <Txt style={S.small}>Handoffs still awaiting acknowledgement</Txt>
        </Card>
        <Card style={{ flex: 1, minWidth: 145 }}>
          <Text style={S.eyebrow}>RECENT EVENTS</Text>
          <Text style={S.h2}>{counts.total}</Text>
          <Txt style={S.small}>Loaded continuity events</Txt>
        </Card>
      </View>

      {activeSessions.length > 0 && (
        <>
          <Section title="Active on-shift sessions" />
          {activeSessions.map((session) => (
            <Card key={session.id}>
              <View style={S.between}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={S.h3}>{memberName(session.caregiverId)}</Text>
                  <Txt style={S.small}>
                    Started {new Date(session.startedAt).toLocaleString()}
                  </Txt>
                </View>
                <View style={[S.pill, { backgroundColor: "#E3F3EA" }]}>
                  <Text style={[S.small, { color: C.green }]}>On shift</Text>
                </View>
              </View>
            </Card>
          ))}
        </>
      )}

      {pendingTakeovers.length > 0 && (
        <>
          <Section title="Awaiting takeover" />
          {pendingTakeovers.slice(0, 10).map((handoff) => (
            <Card key={handoff.id} style={{ borderColor: "#E7CFAB" }}>
              <Text style={S.h3}>{handoff.shiftLabel}</Text>
              <Txt style={S.small}>
                From {memberName(handoff.createdBy)}
                {handoff.handoffTo
                  ? " → " + memberName(handoff.handoffTo)
                  : " → shared care team"}
              </Txt>
              <Txt>
                {handoff.note ||
                  "This handoff still needs an incoming caregiver acknowledgement."}
              </Txt>
              <Button
                title="Review on shift board"
                secondary
                icon="swap-horizontal-outline"
                onPress={() => n.navigate("CareShiftBoard")}
              />
            </Card>
          ))}
        </>
      )}

      <Section title="Continuity timeline" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {(
          [
            ["all", "All"],
            ["handoffs", "Handoffs " + counts.handoffs],
            ["shifts", "Shift changes " + counts.shiftChanges],
            ["notes", "Notes " + counts.notes],
          ] as Array<[TimelineFilter, string]>
        ).map(([value, label]) => {
          const selected = filter === value;
          return (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => setFilter(value)}
              style={[
                S.pill,
                {
                  minHeight: 42,
                  justifyContent: "center",
                  paddingHorizontal: 13,
                  backgroundColor: selected ? C.purple : C.lavender,
                },
              ]}
            >
              <Text
                style={[
                  S.h3,
                  {
                    fontSize: 11,
                    color: selected ? C.white : C.deep,
                  },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading && !events.length ? (
        <Card>
          <ActivityIndicator color={C.purple} />
          <Txt>Loading continuity history…</Txt>
        </Card>
      ) : filteredEvents.length ? (
        filteredEvents.map((event) => (
          <Card key={event.id}>
            <View style={{ flexDirection: "row", gap: 13 }}>
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 13,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: C.lavender,
                }}
              >
                <Icon name={eventIcon(event.kind)} size={21} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={S.between}>
                  <Text style={[S.h3, { flex: 1 }]}>{event.title}</Text>
                  <View style={S.pill}>
                    <Text style={S.small}>
                      {continuityKindLabel(event.kind)}
                    </Text>
                  </View>
                </View>
                <Txt>{event.detail}</Txt>
                <Txt style={S.small}>
                  {memberName(event.actorUserId)}
                  {event.secondaryUserId
                    ? " → " + memberName(event.secondaryUserId)
                    : ""}{" "}
                  · {new Date(event.at).toLocaleString()}
                </Txt>
              </View>
            </View>
          </Card>
        ))
      ) : (
        <Card>
          <Txt>No continuity events match this filter yet.</Txt>
        </Card>
      )}

      <Button
        title="Open On-Shift Caregiver"
        secondary
        icon="pulse-outline"
        disabled={state.accessRole === "viewer"}
        onPress={() => n.navigate("OnShiftCaregiver")}
      />
      <Button
        title="Open shift board"
        secondary
        icon="swap-horizontal-outline"
        onPress={() => n.navigate("CareShiftBoard")}
      />
      <Button
        title="Open caregiver schedule"
        secondary
        icon="calendar-outline"
        onPress={() => n.navigate("CareSchedule")}
      />
    </Page>
  );
}
