import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  loadFamilyCareDashboard,
  type FamilyCareDashboardSnapshot,
} from "../careDashboard";
import {
  dashboardMedicationActivity,
  type DashboardAttentionItem,
} from "../careDashboardHelpers";
import type { CareRole } from "../careTeam";
import type { MedicationRecord } from "../medications";
import { Button, C, Card, Icon, S, Section, Txt } from "../ui";

type DashboardTarget =
  | "CareTasks"
  | "CareCoordinationInbox"
  | "CareCommunicationLog";

function timeLabel(value: string) {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function dateTimeLabel(value: string) {
  return new Date(value).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function AttentionRow({
  item,
  onOpen,
}: {
  item: DashboardAttentionItem;
  onOpen: () => void;
}) {
  const urgent =
    item.kind === "overdue_task" ||
    item.kind === "time_sensitive_coordination";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.title}
      onPress={onOpen}
      style={{
        borderWidth: 1,
        borderColor: urgent ? "#E8BDC3" : C.line,
        backgroundColor: urgent ? "#FFF8F7" : C.white,
        borderRadius: 16,
        padding: 15,
        gap: 6,
      }}
    >
      <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            backgroundColor: urgent ? C.redBg : C.lavender,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon
            name={
              item.kind === "time_sensitive_coordination"
                ? "warning-outline"
                : item.kind === "communication_follow_up"
                  ? "chatbubbles-outline"
                  : "checkbox-outline"
            }
            size={19}
            color={urgent ? C.rose : C.purple}
          />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={S.h3}>{item.title}</Text>
          <Txt style={S.small}>{item.detail}</Txt>
        </View>
        <Icon name="chevron-forward-outline" size={18} />
      </View>
    </Pressable>
  );
}

export function FamilyCareDashboard({
  careRecipientId,
  careRecipientName,
  accessRole,
  medicationRecords,
  onOpenSchedule,
  onOpenAppointments,
  onOpenTasks,
  onOpenMedications,
  onOpenCommunications,
  onOpenCoordination,
}: {
  careRecipientId: string | null;
  careRecipientName: string;
  accessRole: CareRole;
  medicationRecords: MedicationRecord[];
  onOpenSchedule: () => void;
  onOpenAppointments: () => void;
  onOpenTasks: () => void;
  onOpenMedications: () => void;
  onOpenCommunications: () => void;
  onOpenCoordination: () => void;
}) {
  const [snapshot, setSnapshot] =
    useState<FamilyCareDashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(Boolean(careRecipientId));
  const [message, setMessage] = useState("");

  const medicationActivity = useMemo(
    () => dashboardMedicationActivity(medicationRecords),
    [medicationRecords],
  );

  const refresh = useCallback(async () => {
    if (!careRecipientId) {
      setSnapshot(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      setSnapshot(await loadFamilyCareDashboard(careRecipientId));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not refresh the family care dashboard.",
      );
    } finally {
      setLoading(false);
    }
  }, [careRecipientId]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  function openAttention(item: DashboardAttentionItem) {
    const actions: Record<DashboardTarget, () => void> = {
      CareTasks: onOpenTasks,
      CareCoordinationInbox: onOpenCoordination,
      CareCommunicationLog: onOpenCommunications,
    };
    actions[item.target]();
  }

  if (!careRecipientId) {
    return (
      <Card style={{ backgroundColor: C.lavender }}>
        <Icon name="people-outline" size={28} />
        <Text style={S.h2}>Set up a care profile to unlock the live dashboard.</Text>
        <Txt>
          Coverage, tasks, appointments, communication and coordination are all
          organized around one shared care profile.
        </Txt>
      </Card>
    );
  }

  if (loading && !snapshot) {
    return (
      <Card>
        <ActivityIndicator color={C.purple} />
        <Txt>Building today’s family care picture…</Txt>
      </Card>
    );
  }

  const attentionCount = snapshot?.attention.length ?? 0;
  const activeShift = snapshot?.activeShift ?? null;
  const nextShift = snapshot?.nextShift ?? null;
  const nextAppointment = snapshot?.nextAppointment ?? null;
  const overdueTasks = snapshot?.overdueTasks ?? [];
  const dueTodayTasks = snapshot?.dueTodayTasks ?? [];
  const communications = snapshot?.recentCommunications ?? [];
  const coordination = snapshot?.actionableConflicts ?? [];
  const urgentCoordination = snapshot?.timeSensitiveConflicts ?? [];
  const unassignedUrgent =
    snapshot?.unassignedTimeSensitiveConflicts.length ?? 0;

  return (
    <View style={{ gap: 14 }}>
      <Section title="Family care dashboard" action="Refresh" onPress={() => void refresh()} />

      {Boolean(message) && (
        <Card style={{ backgroundColor: C.redBg }}>
          <Text accessibilityRole="alert" style={[S.body, { color: C.rose }]}>
            {message}
          </Text>
        </Card>
      )}

      <Card
        style={{
          backgroundColor: C.deep,
          borderWidth: 0,
          padding: 20,
          gap: 15,
        }}
      >
        <View style={S.between}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={[S.eyebrow, { color: "#E0C6E8" }]}>
              TODAY AT A GLANCE
            </Text>
            <Text style={[S.h2, { color: C.white, fontSize: 24 }]}>
              {careRecipientName || "Shared care"} command center
            </Text>
          </View>
          <Icon name="grid-outline" color="#E6CE98" size={25} />
        </View>

        <View style={{ flexDirection: "row", gap: 9, flexWrap: "wrap" }}>
          <View
            style={{
              flex: 1,
              minWidth: 96,
              backgroundColor: "#FFFFFF14",
              borderRadius: 13,
              padding: 12,
              gap: 3,
            }}
          >
            <Text style={[S.small, { color: "#DCCEE5" }]}>Needs attention</Text>
            <Text style={[S.h2, { color: C.white }]}>{attentionCount}</Text>
          </View>
          <View
            style={{
              flex: 1,
              minWidth: 96,
              backgroundColor: "#FFFFFF14",
              borderRadius: 13,
              padding: 12,
              gap: 3,
            }}
          >
            <Text style={[S.small, { color: "#DCCEE5" }]}>Overdue tasks</Text>
            <Text style={[S.h2, { color: C.white }]}>{overdueTasks.length}</Text>
          </View>
          <View
            style={{
              flex: 1,
              minWidth: 96,
              backgroundColor: "#FFFFFF14",
              borderRadius: 13,
              padding: 12,
              gap: 3,
            }}
          >
            <Text style={[S.small, { color: "#DCCEE5" }]}>Coordination</Text>
            <Text style={[S.h2, { color: C.white }]}>{coordination.length}</Text>
          </View>
        </View>

        <Txt style={{ color: "#E3D5E9" }}>
          {activeShift
            ? `${activeShift.caregiverName} is covering ${activeShift.shift.label} until ${timeLabel(activeShift.shift.endsAt)}.`
            : nextShift
              ? `No active shift right now. Next: ${nextShift.caregiverName} at ${dateTimeLabel(nextShift.shift.startsAt)}.`
              : "No scheduled caregiver shift is currently on the calendar."}
        </Txt>

        <Text style={[S.small, { color: "#DCCEE5" }]}>
          {accessRole === "viewer"
            ? "Viewer access · live read-only picture"
            : accessRole === "owner"
              ? "Owner access · shared family care picture"
              : "Caregiver access · shared family care picture"}
        </Text>
      </Card>

      <Section title="What needs attention now" />
      {snapshot?.attention.length ? (
        <View style={{ gap: 9 }}>
          {snapshot.attention.map((item) => (
            <AttentionRow
              key={item.id}
              item={item}
              onOpen={() => openAttention(item)}
            />
          ))}
        </View>
      ) : (
        <Card style={{ backgroundColor: "#EAF4EF" }}>
          <View style={S.row}>
            <Icon name="checkmark-circle-outline" color={C.green} size={24} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={S.h3}>Nothing is overdue or time-sensitive right now.</Text>
              <Txt style={S.small}>
                This reflects recorded care-plan data only and is not emergency
                or clinical monitoring.
              </Txt>
            </View>
          </View>
        </Card>
      )}

      <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
        <Card
          onPress={onOpenSchedule}
          label="Today's caregiver coverage"
          style={{ flex: 1, minWidth: 245 }}
        >
          <View style={S.between}>
            <Icon name="people-outline" size={24} />
            <Text style={[S.small, { color: C.purple }]}>Coverage</Text>
          </View>
          <Text style={S.h3}>
            {activeShift
              ? activeShift.caregiverName
              : nextShift
                ? nextShift.caregiverName
                : "No scheduled shift"}
          </Text>
          <Txt style={S.small}>
            {activeShift
              ? `${activeShift.shift.label} · ${timeLabel(activeShift.shift.startsAt)}–${timeLabel(activeShift.shift.endsAt)}`
              : nextShift
                ? `Next: ${nextShift.shift.label} · ${dateTimeLabel(nextShift.shift.startsAt)}`
                : "Open the schedule to plan family coverage."}
          </Txt>
        </Card>

        <Card
          onPress={onOpenAppointments}
          label="Next appointment"
          style={{ flex: 1, minWidth: 245 }}
        >
          <View style={S.between}>
            <Icon name="calendar-outline" size={24} />
            <Text style={[S.small, { color: C.purple }]}>Next visit</Text>
          </View>
          <Text style={S.h3}>
            {nextAppointment?.appointment.title ?? "No upcoming appointment"}
          </Text>
          <Txt style={S.small}>
            {nextAppointment
              ? [
                  dateTimeLabel(nextAppointment.startsAt),
                  nextAppointment.appointment.location,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "Add or review appointments from visit preparation."}
          </Txt>
        </Card>
      </View>

      <Card onPress={onOpenTasks} label="Care work today">
        <View style={S.between}>
          <View style={S.row}>
            <Icon name="checkbox-outline" />
            <Text style={S.h3}>Care work today</Text>
          </View>
          <Text style={[S.small, { color: overdueTasks.length ? C.rose : C.purple }]}>
            {overdueTasks.length} overdue · {dueTodayTasks.length} due today
          </Text>
        </View>

        {overdueTasks.length || dueTodayTasks.length ? (
          [...overdueTasks, ...dueTodayTasks]
            .filter(
              (task, index, rows) =>
                rows.findIndex((row) => row.id === task.id) === index,
            )
            .slice(0, 3)
            .map((task) => (
              <View key={task.id} style={S.between}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[S.h3, { fontSize: 13 }]}>{task.title}</Text>
                  <Txt style={S.small}>{dateTimeLabel(task.dueAt)}</Txt>
                </View>
                {new Date(task.dueAt).getTime() < Date.now() && (
                  <View style={[S.pill, { backgroundColor: C.redBg }]}>
                    <Text style={[S.small, { color: C.rose }]}>Overdue</Text>
                  </View>
                )}
              </View>
            ))
        ) : (
          <Txt style={S.small}>No open care tasks are due today.</Txt>
        )}
      </Card>

      <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
        <Card
          onPress={onOpenMedications}
          label="Medication activity"
          style={{ flex: 1, minWidth: 245 }}
        >
          <View style={S.between}>
            <Icon name="medical-outline" size={24} />
            <Text style={[S.small, { color: C.purple }]}>Recorded activity</Text>
          </View>
          <Text style={S.h3}>
            {medicationActivity.todayCount
              ? `${medicationActivity.todayCount} record${medicationActivity.todayCount === 1 ? "" : "s"} today`
              : "No dose records today"}
          </Text>
          <Txt style={S.small}>
            {medicationActivity.latest
              ? `Latest: ${medicationActivity.latest.medication.name} · ${dateTimeLabel(medicationActivity.latest.recordedAt)}`
              : "Medication activity appears here after it is recorded."}
          </Txt>
        </Card>

        <Card
          onPress={onOpenCoordination}
          label="Coordination status"
          style={{ flex: 1, minWidth: 245 }}
        >
          <View style={S.between}>
            <Icon name="warning-outline" size={24} />
            <Text style={[S.small, { color: urgentCoordination.length ? C.rose : C.purple }]}>
              Family workflow
            </Text>
          </View>
          <Text style={S.h3}>
            {coordination.length
              ? `${coordination.length} open coordination item${coordination.length === 1 ? "" : "s"}`
              : "No active coordination conflicts"}
          </Text>
          <Txt style={S.small}>
            {urgentCoordination.length
              ? `${urgentCoordination.length} time-sensitive · ${unassignedUrgent} still unassigned`
              : "Current recorded plan has no time-sensitive coordination flag."}
          </Txt>
        </Card>
      </View>

      <Card onPress={onOpenCommunications} label="Recent family communication">
        <View style={S.between}>
          <View style={S.row}>
            <Icon name="chatbubbles-outline" />
            <Text style={S.h3}>Recent family communication</Text>
          </View>
          <Text style={[S.small, { color: C.purple }]}>Open log</Text>
        </View>

        {communications.length ? (
          communications.map((communication) => (
            <View key={communication.id} style={{ gap: 3 }}>
              <View style={S.between}>
                <Text style={[S.h3, { flex: 1, fontSize: 13 }]}>
                  {communication.summary}
                </Text>
                {communication.followUpNeeded && (
                  <View style={[S.pill, { backgroundColor: C.lavender }]}>
                    <Txt style={S.small}>Follow-up</Txt>
                  </View>
                )}
              </View>
              <Txt style={S.small}>
                {[
                  communication.personSpokenTo,
                  communication.organizationName,
                  dateTimeLabel(communication.occurredAt),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Txt>
            </View>
          ))
        ) : (
          <Txt style={S.small}>
            Calls, portal messages, insurance updates and family notes will
            appear here after they are logged.
          </Txt>
        )}
      </Card>

      <Button
        title={loading ? "Refreshing dashboard…" : "Refresh live dashboard"}
        secondary
        disabled={loading}
        icon="refresh-outline"
        onPress={() => void refresh()}
      />
    </View>
  );
}
