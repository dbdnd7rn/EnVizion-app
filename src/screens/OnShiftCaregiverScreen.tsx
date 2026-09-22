import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { loadCareAgendaData, type CareAgendaData } from "../careAgenda";
import {
  loadCareCommunications,
  type CareCommunication,
} from "../careCommunications";
import { detectCoordinationConflicts } from "../careCoordinationConflicts";
import {
  loadCoordinationWorkflow,
  type CoordinationWorkflowData,
} from "../careCoordinationWorkflow";
import { currentActionableConflicts } from "../careCoordinationWorkflowHelpers";
import { nextDashboardAppointment } from "../careDashboardHelpers";
import {
  loadCareSchedule,
  type CareShift,
  type CaregiverAvailability,
} from "../careSchedule";
import {
  completeCareTask,
  currentCareTaskUserId,
  loadCareTaskCompletions,
  loadCareTasks,
  type CareTask,
  type CareTaskCompletion,
} from "../careTasks";
import {
  loadCareTeam,
  type CareTeamMember,
  type CareTeamRoster,
} from "../careTeam";
import {
  handoffAppointmentSnapshot,
  handoffCommunicationActivity,
  handoffCoordinationActivity,
  handoffFollowUps,
  handoffMedicationActivity,
} from "../shiftBriefingHelpers";
import {
  loadHandoffMedicationRecords,
} from "../shiftBoard";
import {
  shiftSnapshotCompletion,
  shiftSnapshotTask,
  shiftTaskBucket,
} from "../shiftBoardHelpers";
import {
  actualCoverageNow,
} from "../shiftAttendanceHelpers";
import {
  loadShiftAttendance,
  type CareShiftAttendance,
} from "../shiftAttendance";
import {
  addCaregiverShiftSessionNote,
  finishOnShiftWithHandoff,
  loadActiveCaregiverShiftSession,
  loadCaregiverShiftSessionNotes,
  type CaregiverShiftSession,
  type CaregiverShiftSessionNote,
} from "../onShiftCaregiver";
import {
  onShiftCompletions,
  onShiftDurationLabel,
  onShiftElapsedMinutes,
  onShiftResponsibilities,
} from "../onShiftHelpers";
import {
  buildOnShiftActivityTimeline,
  onShiftActivityCounts,
  type OnShiftActivity,
} from "../onShiftActivityHelpers";
import type { MedicationRecord } from "../medications";
import { supabase } from "../supabase";
import { useCare } from "../store";
import {
  Button,
  C,
  Card,
  Field,
  Heading,
  Icon,
  Page,
  S,
  Section,
  Txt,
} from "../ui";
import { useNav } from "./MainScreens";

function defaultShiftLabel() {
  const hour = new Date().getHours();
  if (hour < 12) return "Morning caregiver handoff";
  if (hour < 18) return "Afternoon caregiver handoff";
  return "Evening caregiver handoff";
}

function MemberChoice({
  title,
  subtitle,
  selected,
  disabled,
  onPress,
}: {
  title: string;
  subtitle?: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        S.card,
        {
          padding: 13,
          borderColor: selected ? C.purple : C.line,
          backgroundColor: selected ? "#F6F0F8" : C.white,
          opacity: disabled ? 0.55 : 1,
        },
      ]}
    >
      <View style={S.row}>
        <Icon
          name={selected ? "checkmark-circle" : "ellipse-outline"}
          color={selected ? C.purple : C.muted}
          size={20}
        />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[S.h3, { fontSize: 13 }]}>{title}</Text>
          {Boolean(subtitle) && <Txt style={S.small}>{subtitle}</Txt>}
        </View>
      </View>
    </Pressable>
  );
}

function TaskCard({
  task,
  busy,
  onComplete,
}: {
  task: CareTask;
  busy: boolean;
  onComplete: () => void;
}) {
  const bucket = shiftTaskBucket(task);
  const urgent = bucket === "overdue" || bucket === "due_soon";

  return (
    <Card
      style={{
        borderColor: urgent ? "#E8BDC3" : C.line,
        backgroundColor: urgent ? "#FFF9F8" : C.white,
      }}
    >
      <View style={S.between}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={S.h3}>{task.title}</Text>
          <Txt style={S.small}>
            Due {new Date(task.dueAt).toLocaleString()}
          </Txt>
        </View>
        <View
          style={[
            S.pill,
            {
              backgroundColor:
                bucket === "overdue"
                  ? C.redBg
                  : bucket === "due_soon"
                    ? "#FFF1E5"
                    : C.lavender,
            },
          ]}
        >
          <Text
            style={[
              S.small,
              { color: bucket === "overdue" ? C.rose : C.purple },
            ]}
          >
            {bucket === "overdue"
              ? "Overdue"
              : bucket === "due_soon"
                ? "Due soon"
                : "Open"}
          </Text>
        </View>
      </View>

      {Boolean(task.details) && <Txt>{task.details}</Txt>}

      <Button
        title={busy ? "Completing…" : "Mark complete"}
        secondary
        disabled={busy}
        icon="checkmark-outline"
        onPress={onComplete}
      />
    </Card>
  );
}

export function OnShiftCaregiverScreen() {
  const n = useNav();
  const { state } = useCare();
  const careRecipientId = state.careRecipientId;
  const readOnly = state.accessRole === "viewer";

  const [session, setSession] = useState<CaregiverShiftSession | null>(null);
  const [notes, setNotes] = useState<CaregiverShiftSessionNote[]>([]);
  const [tasks, setTasks] = useState<CareTask[]>([]);
  const [completions, setCompletions] = useState<CareTaskCompletion[]>([]);
  const [shifts, setShifts] = useState<CareShift[]>([]);
  const [availability, setAvailability] = useState<CaregiverAvailability[]>([]);
  const [attendance, setAttendance] = useState<CareShiftAttendance[]>([]);
  const [agenda, setAgenda] = useState<CareAgendaData>({
    appointments: [],
    tasks: [],
    shifts: [],
    handoffs: [],
    followUps: [],
  });
  const [communications, setCommunications] = useState<CareCommunication[]>([]);
  const [medicationRecords, setMedicationRecords] = useState<MedicationRecord[]>([]);
  const [workflow, setWorkflow] = useState<CoordinationWorkflowData>({
    resolutions: [],
    comments: [],
    history: [],
  });
  const [roster, setRoster] = useState<CareTeamRoster | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [quickNote, setQuickNote] = useState("");

  const [ending, setEnding] = useState(false);
  const [reviewedUrgentCloseout, setReviewedUrgentCloseout] = useState(false);
  const [handoffTo, setHandoffTo] = useState<string | null>(null);
  const [shiftLabel, setShiftLabel] = useState(defaultShiftLabel());
  const [endNote, setEndNote] = useState("");

  const refresh = useCallback(async () => {
    if (!careRecipientId || readOnly) {
      setSession(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const [userId, activeSession] = await Promise.all([
        currentCareTaskUserId(),
        loadActiveCaregiverShiftSession(careRecipientId),
      ]);

      setCurrentUserId(userId);
      setSession(activeSession);

      if (!activeSession) {
        setNotes([]);
        setLoading(false);
        return;
      }

      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);

      const [
        taskRows,
        completionRows,
        schedule,
        attendanceRows,
        agendaRows,
        communicationRows,
        medicationRows,
        workflowRows,
        team,
        noteRows,
      ] = await Promise.all([
        loadCareTasks(careRecipientId),
        loadCareTaskCompletions(careRecipientId),
        loadCareSchedule(careRecipientId),
        loadShiftAttendance(careRecipientId),
        loadCareAgendaData({
          careRecipientId,
          rangeStartIso: start.toISOString(),
          rangeEndIso: end.toISOString(),
        }),
        loadCareCommunications(careRecipientId),
        loadHandoffMedicationRecords(careRecipientId),
        loadCoordinationWorkflow(careRecipientId),
        loadCareTeam(careRecipientId),
        loadCaregiverShiftSessionNotes(careRecipientId, activeSession.id),
      ]);

      setTasks(taskRows);
      setCompletions(completionRows);
      setShifts(schedule.shifts);
      setAvailability(schedule.availability);
      setAttendance(attendanceRows);
      setAgenda(agendaRows);
      setCommunications(communicationRows);
      setMedicationRecords(medicationRows);
      setWorkflow(workflowRows);
      setRoster(team);
      setNotes(noteRows);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not load your on-shift workspace.",
      );
    } finally {
      setLoading(false);
    }
  }, [careRecipientId, readOnly]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!careRecipientId || readOnly) return;

    const refreshTables = [
      "caregiver_shift_sessions",
      "caregiver_shift_session_notes",
      "care_tasks",
      "care_task_completions",
      "care_shifts",
      "care_shift_attendance",
      "care_communications",
      "care_coordination_resolutions",
      "appointments",
      "medication_records",
    ];

    let channel = supabase.channel(`on-shift:${careRecipientId}`);
    for (const table of refreshTables) {
      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => void refresh(),
      );
    }
    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [careRecipientId, readOnly, refresh]);

  const members = useMemo(
    () =>
      roster?.members.filter(
        (member) =>
          member.status === "active" &&
          (member.role === "owner" || member.role === "caregiver"),
      ) ?? [],
    [roster],
  );

  const memberMap = useMemo(
    () => new Map(members.map((member) => [member.userId, member])),
    [members],
  );

  function memberName(userId: string | null) {
    if (!userId) return "Shared care team";
    const member = memberMap.get(userId);
    if (!member) return "Caregiver";
    return member.isCurrentUser
      ? `${member.displayName || "Me"} (me)`
      : member.displayName || "Caregiver";
  }

  const responsibilities = useMemo(
    () => onShiftResponsibilities(tasks, currentUserId),
    [currentUserId, tasks],
  );

  const shiftCompletions = useMemo(
    () => (session ? onShiftCompletions(completions, session) : []),
    [completions, session],
  );

  const activityTimeline = useMemo(
    () =>
      session
        ? buildOnShiftActivityTimeline({
            session,
            notes,
            taskCompletions: completions,
            tasks,
            medicationRecords,
            communications,
          })
        : [],
    [communications, completions, medicationRecords, notes, session, tasks],
  );

  const activityCounts = useMemo(
    () => onShiftActivityCounts(activityTimeline),
    [activityTimeline],
  );

  const coverage = useMemo(
    () => actualCoverageNow(shifts, attendance),
    [attendance, shifts],
  );

  const conflicts = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    return detectCoordinationConflicts({
      agenda,
      shifts,
      availability,
      rangeStart: start.toISOString(),
      rangeEnd: end.toISOString(),
    });
  }, [agenda, availability, shifts]);

  const actionableCoordination = useMemo(
    () => currentActionableConflicts(conflicts, workflow.resolutions),
    [conflicts, workflow.resolutions],
  );

  const nextAppointment = useMemo(
    () => nextDashboardAppointment(agenda.appointments),
    [agenda.appointments],
  );

  const medicationSnapshot = useMemo(
    () =>
      session
        ? handoffMedicationActivity(medicationRecords, session.startedAt)
        : [],
    [medicationRecords, session],
  );

  const communicationSnapshot = useMemo(
    () =>
      session
        ? handoffCommunicationActivity(communications, session.startedAt)
        : [],
    [communications, session],
  );

  const coordinationSnapshot = useMemo(
    () => handoffCoordinationActivity(actionableCoordination),
    [actionableCoordination],
  );

  const followUps = useMemo(
    () => handoffFollowUps(communications),
    [communications],
  );

  const nextAppointmentSnapshot = useMemo(
    () => handoffAppointmentSnapshot(nextAppointment),
    [nextAppointment],
  );

  async function complete(task: CareTask) {
    if (!careRecipientId || !session || readOnly || busyId) return;

    setBusyId(task.id);
    setMessage("");
    try {
      await completeCareTask(careRecipientId, task.id, "Completed during active caregiver shift.");
      await refresh();
      setMessage(`${task.title} marked complete.`);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not complete this task.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function addQuickNote() {
    if (!careRecipientId || !session || readOnly || busyId) return;

    setBusyId("quick-note");
    setMessage("");
    try {
      await addCaregiverShiftSessionNote({
        careRecipientId,
        sessionId: session.id,
        body: quickNote,
      });
      setQuickNote("");
      await refresh();
      setMessage("Shift note added.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not add this shift note.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function endShift() {
    if (!session || !careRecipientId || readOnly || busyId) return;

    setBusyId("end-shift");
    setMessage("");

    try {
      const taskMap = new Map(tasks.map((task) => [task.id, task]));
      const openSnapshot = tasks
        .filter((task) => task.status === "open")
        .map((task) => shiftSnapshotTask(task, memberName(task.assignedTo)));
      const completedSnapshot = shiftCompletions.map((completion) =>
        shiftSnapshotCompletion(
          completion,
          taskMap.get(completion.taskId)?.title || "Care task",
          memberName(completion.completedBy),
        ),
      );

      const result = await finishOnShiftWithHandoff({
        sessionId: session.id,
        handoffTo,
        shiftLabel,
        note: endNote,
        openTaskSnapshot: openSnapshot,
        completedTaskSnapshot: completedSnapshot,
        briefingWindowStart: session.startedAt,
        medicationActivitySnapshot: medicationSnapshot,
        communicationSnapshot,
        coordinationSnapshot,
        nextAppointmentSnapshot,
        followUpSnapshot: followUps,
      });

      setEnding(false);
      setReviewedUrgentCloseout(false);
      setEndNote("");
      setHandoffTo(null);
      setMessage(
        `Shift ended at ${new Date(result.endedAt).toLocaleString()} and the next briefing was created.`,
      );
      await refresh();
      n.navigate("CareShiftBoard");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not end this shift and create the next handoff.",
      );
    } finally {
      setBusyId(null);
    }
  }

  if (!careRecipientId) {
    return (
      <Page>
        <Heading
          eyebrow="ON-SHIFT CAREGIVER"
          title="Choose a care profile first."
          body="On-shift mode follows one shared care profile at a time."
        />
      </Page>
    );
  }

  if (readOnly) {
    return (
      <Page>
        <Heading
          eyebrow="ON-SHIFT CAREGIVER"
          title="On-shift mode is for active Owners and Caregivers."
          body="Viewer access remains read-only. You can still review the Shift Board and handoff history."
        />
        <Button
          title="Open caregiver shift board"
          onPress={() => n.navigate("CareShiftBoard")}
        />
      </Page>
    );
  }

  if (loading && !session) {
    return (
      <Page>
        <ActivityIndicator color={C.purple} />
        <Txt>Loading your active shift…</Txt>
      </Page>
    );
  }

  if (!session) {
    return (
      <Page>
        <Heading
          eyebrow="ON-SHIFT CAREGIVER"
          title="You do not have an active takeover right now."
          body="Accept a new caregiver handoff from the Shift Board to start focused on-shift mode."
        />
        {Boolean(message) && (
          <Card>
            <Text accessibilityRole="alert" style={S.body}>
              {message}
            </Text>
          </Card>
        )}
        <Button
          title="Open caregiver shift board"
          icon="swap-horizontal-outline"
          onPress={() => n.navigate("CareShiftBoard")}
        />
      </Page>
    );
  }

  const elapsed = onShiftDurationLabel(onShiftElapsedMinutes(session));
  const currentUserCheckedIn = coverage.checkedInNow.some(
    (shift) => shift.caregiverId === currentUserId,
  );

  return (
    <Page>
      <Heading
        eyebrow="ON-SHIFT CAREGIVER MODE"
        title="Your focused care workspace."
        body="Work from live shared care data, record what changes during your shift, then hand over cleanly to the next caregiver."
      />

      <Card style={{ backgroundColor: C.deep, borderWidth: 0 }}>
        <View style={S.between}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[S.eyebrow, { color: "#E7CFEF" }]}>ACTIVE SHIFT</Text>
            <Text style={[S.h2, { color: C.white }]}>
              {state.careRecipientName || "Shared care"}
            </Text>
            <Txt style={{ color: "#E9DDED" }}>
              Started {new Date(session.startedAt).toLocaleString()} · {elapsed}
            </Txt>
          </View>
          <Icon name="pulse-outline" color="#E6CE98" size={28} />
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <View style={[S.pill, { backgroundColor: "#FFFFFF18" }]}>
            <Text style={[S.small, { color: C.white }]}>
              {responsibilities.mine.length} mine
            </Text>
          </View>
          <View style={[S.pill, { backgroundColor: "#FFFFFF18" }]}>
            <Text style={[S.small, { color: C.white }]}>
              {responsibilities.shared.length} shared
            </Text>
          </View>
          <View style={[S.pill, { backgroundColor: "#FFFFFF18" }]}>
            <Text style={[S.small, { color: C.white }]}>
              {shiftCompletions.length} completed this shift
            </Text>
          </View>
        </View>
      </Card>

      {Boolean(message) && (
        <Card>
          <Text accessibilityRole="alert" style={S.body}>
            {message}
          </Text>
        </Card>
      )}

      <Section title="Quick care actions" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {[
          {
            title: "Record observation",
            subtitle: "Vitals or care journal",
            icon: "pulse-outline",
            onPress: () => n.navigate("Tracker", { kind: "Vitals" }),
          },
          {
            title: "Medication log",
            subtitle: "Record or review entries",
            icon: "medical-outline",
            onPress: () => n.navigate("Medications"),
          },
          {
            title: "Log communication",
            subtitle: "Calls, messages & follow-ups",
            icon: "chatbox-ellipses-outline",
            onPress: () => n.navigate("CareCommunicationLog"),
          },
          {
            title: "Care tasks",
            subtitle: "Create or reassign work",
            icon: "checkmark-done-outline",
            onPress: () => n.navigate("CareTasks"),
          },
          {
            title: "Coordination inbox",
            subtitle: "Resolve schedule conflicts",
            icon: "git-merge-outline",
            onPress: () => n.navigate("CareCoordinationInbox"),
          },
          {
            title: "Emergency help",
            subtitle: "Open urgent support guidance",
            icon: "alert-circle-outline",
            onPress: () => n.navigate("Emergency"),
          },
        ].map((action) => (
          <Card
            key={action.title}
            onPress={action.onPress}
            label={action.title}
            style={{ flex: 1, minWidth: 210 }}
          >
            <Icon name={action.icon} />
            <Text style={S.h3}>{action.title}</Text>
            <Txt style={S.small}>{action.subtitle}</Txt>
          </Card>
        ))}
      </View>

      {responsibilities.urgent.length > 0 && (
        <>
          <Section title="Needs attention during this shift" />
          {responsibilities.urgent.slice(0, 5).map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              busy={busyId === task.id}
              onComplete={() => void complete(task)}
            />
          ))}
        </>
      )}

      <Section title="My responsibilities" />
      {responsibilities.mine.length ? (
        responsibilities.mine.slice(0, 8).map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            busy={busyId === task.id}
            onComplete={() => void complete(task)}
          />
        ))
      ) : (
        <Card>
          <Txt>No open tasks are assigned directly to you right now.</Txt>
        </Card>
      )}

      <Section title="Shared / unassigned work" />
      {responsibilities.shared.length ? (
        responsibilities.shared.slice(0, 8).map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            busy={busyId === task.id}
            onComplete={() => void complete(task)}
          />
        ))
      ) : (
        <Card>
          <Txt>No shared or unassigned care tasks are open right now.</Txt>
        </Card>
      )}

      <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
        <Card style={{ flex: 1, minWidth: 230 }}>
          <View style={S.between}>
            <Icon name="people-outline" />
            <Text style={[S.small, { color: C.purple }]}>Current coverage</Text>
          </View>
          <Text style={S.h3}>
            {coverage.scheduledNow.length
              ? `${coverage.checkedInNow.length}/${coverage.scheduledNow.length} scheduled caregiver${coverage.scheduledNow.length === 1 ? "" : "s"} checked in`
              : "No scheduled coverage right now"}
          </Text>
          <Txt style={S.small}>
            {currentUserCheckedIn
              ? "Your scheduled attendance is checked in."
              : "On-shift takeover status and scheduled attendance are tracked separately."}
          </Txt>
        </Card>

        <Card
          style={{ flex: 1, minWidth: 230 }}
          onPress={() => n.navigate("Appointments")}
          label="Upcoming appointment"
        >
          <View style={S.between}>
            <Icon name="calendar-outline" />
            <Text style={[S.small, { color: C.purple }]}>Next visit</Text>
          </View>
          <Text style={S.h3}>
            {nextAppointmentSnapshot?.title ?? "No upcoming appointment"}
          </Text>
          <Txt style={S.small}>
            {nextAppointmentSnapshot
              ? [
                  new Date(nextAppointmentSnapshot.startsAt).toLocaleString(),
                  nextAppointmentSnapshot.location,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "No future visit is currently recorded in the next seven days."}
          </Txt>
        </Card>
      </View>

      <Section title="Medication activity this shift" />
      <Card onPress={() => n.navigate("Medications")} label="Medication activity">
        <View style={S.between}>
          <Text style={S.h3}>
            {medicationSnapshot.length} medication activit
            {medicationSnapshot.length === 1 ? "y" : "ies"} recorded
          </Text>
          <Icon name="medical-outline" />
        </View>
        {medicationSnapshot.slice(0, 4).map((item) => (
          <Txt key={item.id} style={S.small}>
            • {item.medicationName} ·{" "}
            {new Date(item.recordedAt).toLocaleString()}
            {item.correctedAt ? " · corrected/withdrawn" : ""}
          </Txt>
        ))}
        {!medicationSnapshot.length && (
          <Txt style={S.small}>No medication activity has been recorded since takeover.</Txt>
        )}
      </Card>

      <Section title="Follow-ups & coordination" />
      <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
        <Card
          style={{ flex: 1, minWidth: 230 }}
          onPress={() => n.navigate("CareCommunicationLog")}
          label="Care follow-ups"
        >
          <Text style={S.h3}>
            {followUps.length} explicit follow-up
            {followUps.length === 1 ? "" : "s"}
          </Text>
          {followUps.slice(0, 3).map((item) => (
            <Txt key={item.id} style={S.small}>
              • {item.summary} · {new Date(item.followUpAt).toLocaleString()}
            </Txt>
          ))}
          {!followUps.length && <Txt style={S.small}>No follow-ups are currently flagged.</Txt>}
        </Card>

        <Card
          style={{ flex: 1, minWidth: 230 }}
          onPress={() => n.navigate("CareCoordinationInbox")}
          label="Coordination items"
        >
          <Text style={S.h3}>
            {actionableCoordination.length} open coordination item
            {actionableCoordination.length === 1 ? "" : "s"}
          </Text>
          {coordinationSnapshot.slice(0, 3).map((item) => (
            <Txt key={item.id} style={S.small}>
              • {item.title}
              {item.priority === "time_sensitive" ? " · time-sensitive" : ""}
            </Txt>
          ))}
          {!actionableCoordination.length && (
            <Txt style={S.small}>No active coordination conflicts are recorded.</Txt>
          )}
        </Card>
      </View>

      <Section title="What happened this shift" />
      <Card style={{ backgroundColor: "#F8F4F9" }}>
        <View style={S.between}>
          <View style={{ flex: 1 }}>
            <Text style={S.h3}>{activityCounts.total} recorded shift events</Text>
            <Txt style={S.small}>
              {activityCounts.task_completed} task ·{" "}
              {activityCounts.medication_recorded + activityCounts.medication_corrected} medication ·{" "}
              {activityCounts.communication} communication ·{" "}
              {activityCounts.shift_note} note
            </Txt>
          </View>
          <Icon name="time-outline" />
        </View>
      </Card>

      {activityTimeline.slice(0, 12).map((item: OnShiftActivity) => (
        <Card key={item.id}>
          <View style={S.between}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={S.h3}>{item.title}</Text>
              {Boolean(item.detail) && <Txt>{item.detail}</Txt>}
            </View>
            <Text style={S.small}>
              {new Date(item.occurredAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>
        </Card>
      ))}

            <Section title="Quick shift notes" />
      <Card>
        <Field
          label="Add a shift note"
          value={quickNote}
          onChange={(value) => setQuickNote(value.slice(0, 2000))}
          multiline
        />
        <Button
          title={busyId === "quick-note" ? "Adding note…" : "Add note"}
          secondary
          disabled={Boolean(busyId) || !quickNote.trim()}
          icon="create-outline"
          onPress={() => void addQuickNote()}
        />
        <Txt style={S.small}>
          Shift notes are append-only and become part of the care activity trail.
        </Txt>
      </Card>

      {notes.slice(0, 8).map((note) => (
        <Card key={note.id}>
          <Txt>{note.body}</Txt>
          <Txt style={S.small}>{new Date(note.createdAt).toLocaleString()}</Txt>
        </Card>
      ))}

      {!ending ? (
        <Button
          title="End my shift & prepare next handoff"
          icon="swap-horizontal-outline"
          onPress={() => {
            setShiftLabel(defaultShiftLabel());
            setEndNote("");
            setHandoffTo(null);
            setReviewedUrgentCloseout(false);
            setEnding(true);
          }}
        />
      ) : (
        <>
          <Section title="End shift & hand over" />
          <Card>
            <Field
              label="Handoff label"
              value={shiftLabel}
              onChange={(value) => setShiftLabel(value.slice(0, 160))}
            />
            <Field
              label="What should the next caregiver know?"
              value={endNote}
              onChange={(value) => setEndNote(value.slice(0, 4000))}
              multiline
            />

            <Text style={S.h3}>Send the next briefing to</Text>
            <MemberChoice
              title="Whole active care team"
              subtitle="The first eligible caregiver who accepts becomes the next active shift."
              selected={handoffTo === null}
              disabled={busyId === "end-shift"}
              onPress={() => setHandoffTo(null)}
            />
            {members
              .filter((member) => member.userId !== currentUserId)
              .map((member: CareTeamMember) => (
                <MemberChoice
                  key={member.userId}
                  title={member.displayName || "Caregiver"}
                  subtitle={member.role === "owner" ? "Care owner" : "Caregiver"}
                  selected={handoffTo === member.userId}
                  disabled={busyId === "end-shift"}
                  onPress={() => setHandoffTo(member.userId)}
                />
              ))}

            {responsibilities.urgent.length > 0 && (
              <Card
                style={{
                  backgroundColor: "#FFF9F8",
                  borderColor: "#E8BDC3",
                }}
              >
                <Text style={[S.h3, { color: C.rose }]}>
                  Outstanding time-sensitive work
                </Text>
                <Txt>
                  {responsibilities.urgent.length} overdue or due-soon task
                  {responsibilities.urgent.length === 1 ? "" : "s"} will remain open for the next caregiver.
                </Txt>
                {responsibilities.urgent.slice(0, 5).map((task) => (
                  <Txt key={task.id} style={S.small}>
                    • {task.title} · due {new Date(task.dueAt).toLocaleString()}
                  </Txt>
                ))}
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: reviewedUrgentCloseout }}
                  disabled={busyId === "end-shift"}
                  onPress={() =>
                    setReviewedUrgentCloseout((value) => !value)
                  }
                  style={[S.row, { minHeight: 44 }]}
                >
                  <Icon
                    name={
                      reviewedUrgentCloseout
                        ? "checkmark-circle"
                        : "ellipse-outline"
                    }
                    color={reviewedUrgentCloseout ? C.green : C.muted}
                  />
                  <Text style={[S.body, { flex: 1 }]}>
                    I reviewed this outstanding work for handoff.
                  </Text>
                </Pressable>
                <Txt style={S.small}>
                  Add a handoff note below so the next caregiver can see what remains.
                </Txt>
              </Card>
            )}

            <Card style={{ backgroundColor: "#F8F4F9" }}>
              <Text style={S.h3}>Closeout preview</Text>
              <Txt>
                {tasks.filter((task) => task.status === "open").length} unfinished ·{" "}
                {shiftCompletions.length} completed this shift
              </Txt>
              <Txt>
                {medicationSnapshot.length} medication ·{" "}
                {communicationSnapshot.length} communication ·{" "}
                {coordinationSnapshot.length} coordination ·{" "}
                {followUps.length} follow-up
              </Txt>
              <Txt style={S.small}>
                Ending the shift and creating this next briefing happen in one
                database transaction. Existing task ownership is preserved.
              </Txt>
            </Card>

            <Button
              title={
                busyId === "end-shift"
                  ? "Ending shift…"
                  : "End shift & create next briefing"
              }
              disabled={
                Boolean(busyId) ||
                (responsibilities.urgent.length > 0 &&
                  (!reviewedUrgentCloseout || !endNote.trim()))
              }
              icon="checkmark-done-outline"
              onPress={() => void endShift()}
            />
            <Button
              title="Keep working"
              secondary
              disabled={Boolean(busyId)}
              onPress={() => {
                setReviewedUrgentCloseout(false);
                setEnding(false);
              }}
            />
          </Card>
        </>
      )}

      <Txt style={S.small}>
        On-shift mode coordinates recorded care work. It is not emergency
        monitoring and does not determine medical urgency.
      </Txt>
    </Page>
  );
}
