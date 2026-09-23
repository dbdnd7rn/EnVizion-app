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
  buildCareCoverageBridge,
  coverageBridgeStateLabel,
  coverageMinutesLabel,
} from "../careCoverageBridgeHelpers";
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
  shifts: [],
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

function bridgeBackground(state: ReturnType<typeof buildCareCoverageBridge>["state"]) {
  if (state === "uncovered_now" || state === "gap_ahead") return C.redBg;
  if (state === "seamless_transition" || state === "covered_now") return "#EAF4EF";
  if (state === "overlap_ahead") return "#FFF1E5";
  return C.lavender;
}

function bridgeAccent(state: ReturnType<typeof buildCareCoverageBridge>["state"]) {
  if (state === "uncovered_now" || state === "gap_ahead") return C.rose;
  if (state === "seamless_transition" || state === "covered_now") return C.green;
  return C.purple;
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
  const [clock, setClock] = useState(() => Date.now());

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
    const timer = setInterval(() => setClock(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!careRecipientId) return;

    const tables = [
      "caregiver_shift_sessions",
      "caregiver_shift_session_notes",
      "care_shift_handoffs",
      "care_shift_handoff_acknowledgements",
      "care_shift_attendance",
      "care_shifts",
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

  const coverageBridge = useMemo(
    () =>
      buildCareCoverageBridge({
        sessions: data.sessions,
        attendance: data.attendance,
        shifts: data.shifts,
        handoffs: data.handoffs,
        acknowledgements: data.acknowledgements,
        now: new Date(clock),
      }),
    [clock, data],
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
        title="See who has care now, who comes next, and what changed between shifts."
        body="Live workspace presence sits alongside durable handoffs, real check-ins, scheduled coverage, and the shift-to-shift continuity timeline."
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

      <Section title="Coverage bridge" />
      <Card
        style={{
          backgroundColor: bridgeBackground(coverageBridge.state),
          borderColor: bridgeAccent(coverageBridge.state),
        }}
      >
        <View style={S.between}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={S.eyebrow}>SHIFT-TO-SHIFT COVERAGE</Text>
            <Text style={S.h2}>
              {coverageBridgeStateLabel(coverageBridge.state)}
            </Text>
          </View>
          <Icon
            name={
              coverageBridge.state === "gap_ahead" ||
              coverageBridge.state === "uncovered_now"
                ? "warning-outline"
                : coverageBridge.state === "seamless_transition"
                  ? "checkmark-circle-outline"
                  : "git-compare-outline"
            }
            color={bridgeAccent(coverageBridge.state)}
            size={28}
          />
        </View>

        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
          <Card style={{ flex: 1, minWidth: 140, backgroundColor: C.white }}>
            <Text style={S.eyebrow}>CARE NOW</Text>
            <Text style={S.h3}>
              {coverageBridge.currentCaregiverId
                ? memberName(coverageBridge.currentCaregiverId)
                : "No confirmed caregiver"}
            </Text>
            <Txt style={S.small}>
              {coverageBridge.currentSession
                ? "Takeover-backed on-shift session"
                : coverageBridge.currentCoverageSource === "attendance"
                  ? "Checked-in scheduled shift"
                  : coverageBridge.currentCoverageSource === "scheduled"
                    ? "Scheduled, but no active check-in recorded"
                    : "No active takeover or check-in"}
            </Txt>
            {coverageBridge.currentCoverageEndsAt && (
              <Txt style={S.small}>
                Planned coverage end ·{" "}
                {new Date(
                  coverageBridge.currentCoverageEndsAt,
                ).toLocaleString()}
              </Txt>
            )}
          </Card>

          <Card style={{ flex: 1, minWidth: 140, backgroundColor: C.white }}>
            <Text style={S.eyebrow}>NEXT SCHEDULED</Text>
            <Text style={S.h3}>
              {coverageBridge.nextShift
                ? memberName(coverageBridge.nextShift.caregiverId)
                : "No next shift recorded"}
            </Text>
            {coverageBridge.nextShift ? (
              <>
                <Txt style={S.small}>
                  {coverageBridge.nextShift.label} ·{" "}
                  {new Date(
                    coverageBridge.nextShift.startsAt,
                  ).toLocaleString()}
                </Txt>
                {coverageBridge.minutesUntilNext !== null && (
                  <Txt style={S.small}>
                    Starts in{" "}
                    {coverageMinutesLabel(
                      coverageBridge.minutesUntilNext,
                    )}
                  </Txt>
                )}
              </>
            ) : (
              <Txt style={S.small}>
                Add the next caregiver shift when coverage is known.
              </Txt>
            )}
          </Card>
        </View>

        {coverageBridge.state === "gap_ahead" && (
          <Txt>
            There is a recorded{" "}
            {coverageMinutesLabel(coverageBridge.gapMinutes)} gap between the
            current planned coverage end and the next scheduled shift.
          </Txt>
        )}

        {coverageBridge.state === "uncovered_now" && (
          <Txt>
            No active takeover or checked-in scheduled shift is recorded right
            now.
            {coverageBridge.nextShift
              ? ` The next scheduled coverage begins in ${coverageMinutesLabel(
                  coverageBridge.gapMinutes,
                )}.`
              : " No future caregiver shift is recorded either."}
          </Txt>
        )}

        {coverageBridge.state === "overlap_ahead" && (
          <Txt>
            The next shift overlaps current planned coverage by{" "}
            {coverageMinutesLabel(coverageBridge.overlapMinutes)}.
          </Txt>
        )}

        {coverageBridge.state === "seamless_transition" && (
          <Txt>
            The next scheduled shift starts within five minutes of the current
            planned coverage end.
          </Txt>
        )}

        {coverageBridge.state === "covered_now" &&
          !coverageBridge.currentCoverageEndsAt && (
            <Txt>
              Care is actively covered, but EnVizion does not have a scheduled
              end time to calculate the next transition gap.
            </Txt>
          )}

        {coverageBridge.state === "no_next_shift" && (
          <Txt>
            Current care activity is recorded, but no future caregiver shift is
            scheduled yet.
          </Txt>
        )}

        {coverageBridge.pendingHandoff && (
          <Card style={{ backgroundColor: "#FFF9F0" }}>
            <Text style={S.eyebrow}>PENDING HANDOFF</Text>
            <Text style={S.h3}>
              {coverageBridge.pendingHandoff.shiftLabel}
            </Text>
            <Txt style={S.small}>
              {coverageBridge.pendingHandoff.handoffTo
                ? "Prepared for " +
                  memberName(coverageBridge.pendingHandoff.handoffTo)
                : "Prepared for the shared care team"}
            </Txt>

            {coverageBridge.handoffMatchesNextCaregiver === false && (
              <Txt style={{ color: C.rose }}>
                The handoff target does not match the next scheduled caregiver.
                Review the schedule and handoff before the transition.
              </Txt>
            )}

            {coverageBridge.handoffMatchesNextCaregiver === true && (
              <Txt style={{ color: C.green }}>
                The handoff target matches the next scheduled caregiver.
              </Txt>
            )}

            <Button
              title="Review pending handoff"
              secondary
              icon="swap-horizontal-outline"
              onPress={() => n.navigate("CareShiftBoard")}
            />
          </Card>
        )}

        <Button
          title={
            coverageBridge.state === "gap_ahead" ||
            coverageBridge.state === "uncovered_now" ||
            coverageBridge.state === "no_next_shift"
              ? "Fix coverage in caregiver schedule"
              : "Review caregiver schedule"
          }
          secondary
          icon="calendar-outline"
          onPress={() => n.navigate("CareSchedule")}
        />
      </Card>

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
