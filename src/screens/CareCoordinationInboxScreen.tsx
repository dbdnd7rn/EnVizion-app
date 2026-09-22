import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { loadCareAgendaData, type CareAgendaData } from "../careAgenda";
import {
  coordinationConflictCounts,
  coordinationConflictKindLabels,
  coordinationConflictKinds,
  detectCoordinationConflicts,
  type CoordinationConflict,
  type CoordinationConflictKind,
} from "../careCoordinationConflicts";
import { loadCareSchedule } from "../careSchedule";
import { loadCareTeam, type CareTeamRoster } from "../careTeam";
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

function horizon(now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return {
    start,
    end,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

function conflictIcon(kind: CoordinationConflictKind) {
  if (kind === "shift_overlap") return "copy-outline";
  if (kind === "appointment_double_booking") return "calendar-outline";
  if (kind === "task_without_coverage") return "shield-outline";
  if (kind === "follow_up_collision") return "chatbubbles-outline";
  if (kind === "long_scheduled_day") return "time-outline";
  return "person-remove-outline";
}

function ConflictCard({
  conflict,
  caregiverName,
  onResolve,
}: {
  conflict: CoordinationConflict;
  caregiverName: (userId: string | null) => string;
  onResolve: () => void;
}) {
  const urgent = conflict.priority === "time_sensitive";

  return (
    <Card
      style={{
        borderColor: urgent ? "#E8BDC3" : C.line,
        backgroundColor: urgent ? "#FFF8F7" : C.white,
      }}
    >
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: urgent ? C.redBg : C.lavender,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon
            name={conflictIcon(conflict.kind)}
            color={urgent ? C.rose : C.purple}
            size={22}
          />
        </View>
        <View style={{ flex: 1, gap: 5 }}>
          <View style={S.between}>
            <Text style={[S.h3, { flex: 1 }]}>{conflict.title}</Text>
            <View
              style={[
                S.pill,
                {
                  backgroundColor: urgent ? C.redBg : C.lavender,
                },
              ]}
            >
              <Text
                style={[
                  S.small,
                  {
                    color: urgent ? C.rose : C.deep,
                    fontFamily: "DMSans_600SemiBold",
                  },
                ]}
              >
                {urgent ? "Time-sensitive" : "Review"}
              </Text>
            </View>
          </View>

          <Txt>{conflict.detail}</Txt>

          <Txt style={S.small}>
            {coordinationConflictKindLabels[conflict.kind]} ·{" "}
            {new Date(conflict.startsAt).toLocaleString()}
            {conflict.caregiverId
              ? ` · ${caregiverName(conflict.caregiverId)}`
              : ""}
          </Txt>
        </View>
      </View>

      <Button
        title="Resolve here"
        secondary
        icon="arrow-forward-outline"
        onPress={onResolve}
      />
    </Card>
  );
}

export function CareCoordinationInboxScreen() {
  const n = useNav();
  const { state } = useCare();
  const careRecipientId = state.careRecipientId;

  const [agenda, setAgenda] = useState<CareAgendaData>({
    appointments: [],
    tasks: [],
    shifts: [],
    handoffs: [],
    followUps: [],
  });
  const [schedule, setSchedule] = useState<Awaited<
    ReturnType<typeof loadCareSchedule>
  > | null>(null);
  const [roster, setRoster] = useState<CareTeamRoster | null>(null);
  const [filters, setFilters] = useState<CoordinationConflictKind[]>([
    ...coordinationConflictKinds,
  ]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const range = useMemo(() => horizon(), []);

  const refresh = useCallback(async () => {
    if (!careRecipientId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const [agendaRows, scheduleRows, team] = await Promise.all([
        loadCareAgendaData({
          careRecipientId,
          rangeStartIso: range.startIso,
          rangeEndIso: range.endIso,
        }),
        loadCareSchedule(careRecipientId),
        loadCareTeam(careRecipientId),
      ]);

      setAgenda(agendaRows);
      setSchedule(scheduleRows);
      setRoster(team);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not check the care plan for coordination conflicts.",
      );
    } finally {
      setLoading(false);
    }
  }, [careRecipientId, range.endIso, range.startIso]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!careRecipientId) return;

    const channel = supabase
      .channel(`care-coordination-inbox:${careRecipientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "care_tasks",
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "care_shifts",
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "caregiver_availability",
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "care_communications",
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [careRecipientId, refresh]);

  const memberMap = useMemo(
    () => new Map((roster?.members ?? []).map((member) => [member.userId, member])),
    [roster],
  );

  function caregiverName(userId: string | null) {
    if (!userId) return "Shared care team";
    const member = memberMap.get(userId);
    if (!member) return "Caregiver";
    return member.isCurrentUser
      ? `${member.displayName || "Me"} (me)`
      : member.displayName || "Caregiver";
  }

  const conflicts = useMemo(
    () =>
      schedule
        ? detectCoordinationConflicts({
            agenda,
            shifts: schedule.shifts,
            availability: schedule.availability,
            rangeStart: range.startIso,
            rangeEnd: range.endIso,
          })
        : [],
    [agenda, range.endIso, range.startIso, schedule],
  );

  const visible = useMemo(() => {
    const selected = new Set(filters);
    return conflicts.filter((conflict) => selected.has(conflict.kind));
  }, [conflicts, filters]);

  const timeSensitive = visible.filter(
    (conflict) => conflict.priority === "time_sensitive",
  );
  const review = visible.filter((conflict) => conflict.priority === "review");
  const counts = coordinationConflictCounts(conflicts);

  function toggleFilter(kind: CoordinationConflictKind) {
    setFilters((current) =>
      current.includes(kind)
        ? current.filter((item) => item !== kind)
        : [...current, kind],
    );
  }

  function resolve(conflict: CoordinationConflict) {
    n.navigate(conflict.fixTarget);
  }

  if (!careRecipientId) {
    return (
      <Page>
        <Heading
          eyebrow="NEEDS COORDINATION"
          title="Choose a care profile first."
          body="Coordination checks follow one shared care profile at a time."
        />
      </Page>
    );
  }

  return (
    <Page>
      <Heading
        eyebrow="NEEDS COORDINATION"
        title="Catch schedule and care-plan collisions before they become confusion."
        body="EnVizion checks the next seven days for overlapping shifts, exact-time appointment double-booking, uncovered tasks, assigned-unavailable conflicts, close appointment follow-ups, and long scheduled caregiver days."
      />

      <Card
        style={{
          backgroundColor: counts.timeSensitive ? C.deep : "#EAF4EF",
          borderWidth: 0,
        }}
      >
        <Text
          style={[
            S.eyebrow,
            { color: counts.timeSensitive ? "#E7CFEF" : C.purple },
          ]}
        >
          NEXT 7 DAYS
        </Text>
        <Text
          style={[
            S.h2,
            { color: counts.timeSensitive ? C.white : C.deep },
          ]}
        >
          {counts.total
            ? `${counts.total} item${counts.total === 1 ? "" : "s"} need coordination`
            : "No coordination conflicts detected"}
        </Text>
        <Txt style={{ color: counts.timeSensitive ? "#E9DDED" : C.ink }}>
          {counts.timeSensitive} time-sensitive · {counts.review} review
        </Txt>
      </Card>

      {Boolean(message) && (
        <Card>
          <Text accessibilityRole="alert" style={S.body}>
            {message}
          </Text>
        </Card>
      )}

      <Section title="Filter inbox" action="Refresh" onPress={() => void refresh()} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {coordinationConflictKinds.map((kind) => {
          const selected = filters.includes(kind);
          return (
            <Pressable
              key={kind}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              onPress={() => toggleFilter(kind)}
              style={[
                S.pill,
                {
                  minHeight: 40,
                  justifyContent: "center",
                  paddingHorizontal: 11,
                  backgroundColor: selected ? C.purple : C.lavender,
                },
              ]}
            >
              <Text
                style={[
                  S.small,
                  {
                    color: selected ? C.white : C.deep,
                    fontFamily: "DMSans_600SemiBold",
                  },
                ]}
              >
                {coordinationConflictKindLabels[kind]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <Card>
          <ActivityIndicator color={C.purple} />
          <Txt>Checking the shared care plan…</Txt>
        </Card>
      ) : !visible.length ? (
        <Card style={{ backgroundColor: "#EAF4EF" }}>
          <Icon name="checkmark-circle-outline" size={30} />
          <Text style={S.h3}>Nothing in the selected filters needs coordination.</Text>
          <Txt>
            This is a planning check, not emergency monitoring. Keep using the
            care team’s normal communication channels for urgent changes.
          </Txt>
        </Card>
      ) : (
        <>
          {timeSensitive.length > 0 && (
            <>
              <Section title="Time-sensitive" />
              {timeSensitive.map((conflict) => (
                <ConflictCard
                  key={conflict.id}
                  conflict={conflict}
                  caregiverName={caregiverName}
                  onResolve={() => resolve(conflict)}
                />
              ))}
            </>
          )}

          {review.length > 0 && (
            <>
              <Section title="Review when planning" />
              {review.map((conflict) => (
                <ConflictCard
                  key={conflict.id}
                  conflict={conflict}
                  caregiverName={caregiverName}
                  onResolve={() => resolve(conflict)}
                />
              ))}
            </>
          )}
        </>
      )}

      <Card style={{ backgroundColor: C.lavender }}>
        <Icon name="information-circle-outline" />
        <Text style={S.h3}>How EnVizion decides what appears here</Text>
        <Txt>
          Appointment double-booking requires the exact same recorded time.
          Follow-up collisions use a 60-minute planning window. A long scheduled
          day flag appears above 12 scheduled hours in one local day. These are
          coordination heuristics, not clinical, employment, or performance
          judgments.
        </Txt>
      </Card>

      <Button
        title="Open family care calendar"
        secondary
        icon="calendar-outline"
        onPress={() => n.navigate("CareCalendar")}
      />
    </Page>
  );
}
