import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import {
  careTaskCategoryLabels,
  careTaskPriorityLabels,
  careTaskRecurrenceLabels,
} from "../careTaskHelpers";
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
  handoffAppointmentSnapshot,
  handoffBriefingCounts,
  handoffCommunicationActivity,
  handoffCoordinationActivity,
  handoffFollowUps,
  handoffMedicationActivity,
  handoffWindowStart,
} from "../shiftBriefingHelpers";
import {
  acceptCareShiftHandoff,
  createCareShiftHandoff,
  loadCareShiftHandoffAcknowledgements,
  loadCareShiftHandoffs,
  loadHandoffMedicationRecords,
  openTasksForShift,
  reassignCareTask,
  todayCompletions,
  type CareShiftHandoff,
  type CareShiftHandoffAcknowledgement,
} from "../shiftBoard";
import {
  latestAcceptableHandoff,
  takeoverResponsibilities,
} from "../shiftTakeoverHelpers";
import {
  shiftBoardCounts,
  shiftSnapshotCompletion,
  shiftSnapshotTask,
  shiftTaskBucket,
  type ShiftTaskBucket,
} from "../shiftBoardHelpers";
import {
  loadCareSchedule,
  type CareShift,
  type CaregiverAvailability,
} from "../careSchedule";
import { uncoveredUpcomingTasks } from "../careScheduleHelpers";
import {
  loadShiftAttendance,
  type CareShiftAttendance,
} from "../shiftAttendance";
import {
  actualCoverageNow,
  attendanceDurationMinutes,
  attendanceForShift,
} from "../shiftAttendanceHelpers";
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

const bucketLabels: Record<ShiftTaskBucket, string> = {
  overdue: "Overdue",
  due_soon: "Due within 1 hour",
  later_today: "Later today",
  future: "Upcoming",
};

function bucketBackground(bucket: ShiftTaskBucket) {
  if (bucket === "overdue") return C.redBg;
  if (bucket === "due_soon") return "#FFF1E5";
  if (bucket === "later_today") return C.lavender;
  return "#EEF3F1";
}

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

export function CareShiftBoardScreen() {
  const n = useNav();
  const { state } = useCare();
  const careRecipientId = state.careRecipientId;
  const readOnly = state.accessRole === "viewer";

  const [tasks, setTasks] = useState<CareTask[]>([]);
  const [completions, setCompletions] = useState<CareTaskCompletion[]>([]);
  const [handoffs, setHandoffs] = useState<CareShiftHandoff[]>([]);
  const [acknowledgements, setAcknowledgements] = useState<
    CareShiftHandoffAcknowledgement[]
  >([]);
  const [shifts, setShifts] = useState<CareShift[]>([]);
  const [availability, setAvailability] = useState<CaregiverAvailability[]>([]);
  const [attendance, setAttendance] = useState<CareShiftAttendance[]>([]);
  const [roster, setRoster] = useState<CareTeamRoster | null>(null);
  const [agenda, setAgenda] = useState<CareAgendaData>({
    appointments: [],
    tasks: [],
    shifts: [],
    handoffs: [],
    followUps: [],
  });
  const [communications, setCommunications] = useState<CareCommunication[]>([]);
  const [handoffMedicationRecords, setHandoffMedicationRecords] = useState(
    state.medicationRecords,
  );
  const [workflow, setWorkflow] = useState<CoordinationWorkflowData>({
    resolutions: [],
    comments: [],
    history: [],
  });
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [reassigningId, setReassigningId] = useState<string | null>(null);

  const [handoffOpen, setHandoffOpen] = useState(false);
  const [handoffTo, setHandoffTo] = useState<string | null>(null);
  const [shiftLabel, setShiftLabel] = useState(defaultShiftLabel());
  const [handoffNote, setHandoffNote] = useState("");
  const [takeoverNote, setTakeoverNote] = useState("");

  const refresh = useCallback(async () => {
    async function acceptTakeover() {
    if (
      !careRecipientId ||
      !pendingTakeover ||
      readOnly ||
      busyId
    ) {
      return;
    }

    setBusyId(`takeover:${pendingTakeover.id}`);
    setMessage("");
    try {
      const acknowledgement = await acceptCareShiftHandoff({
        careRecipientId,
        handoffId: pendingTakeover.id,
        note: takeoverNote,
      });

      setTakeoverNote("");
      await refresh();
      setMessage(
        `Takeover confirmed at ${new Date(
          acknowledgement.acceptedAt,
        ).toLocaleString()}. Existing task ownership was preserved.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not confirm this caregiver takeover.",
      );
    } finally {
      setBusyId(null);
    }
  }

  if (!careRecipientId) {
      setTasks([]);
      setCompletions([]);
      setHandoffs([]);
      setAcknowledgements([]);
      setShifts([]);
      setAvailability([]);
      setAttendance([]);
      setAgenda({
        appointments: [],
        tasks: [],
        shifts: [],
        handoffs: [],
        followUps: [],
      });
      setCommunications([]);
      setHandoffMedicationRecords([]);
      setWorkflow({ resolutions: [], comments: [], history: [] });
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const userId = await currentCareTaskUserId();
      const rangeStart = new Date();
      rangeStart.setHours(0, 0, 0, 0);
      const rangeEnd = new Date(rangeStart);
      rangeEnd.setDate(rangeEnd.getDate() + 7);

      const [
        taskRows,
        completionRows,
        team,
        handoffRows,
        acknowledgementRows,
        schedule,
        attendanceRows,
        agendaRows,
        communicationRows,
        medicationRows,
        workflowRows,
      ] = await Promise.all([
        loadCareTasks(careRecipientId),
        loadCareTaskCompletions(careRecipientId),
        loadCareTeam(careRecipientId),
        loadCareShiftHandoffs(careRecipientId),
        loadCareShiftHandoffAcknowledgements(careRecipientId),
        loadCareSchedule(careRecipientId),
        loadShiftAttendance(careRecipientId),
        loadCareAgendaData({
          careRecipientId,
          rangeStartIso: rangeStart.toISOString(),
          rangeEndIso: rangeEnd.toISOString(),
        }),
        loadCareCommunications(careRecipientId),
        loadHandoffMedicationRecords(careRecipientId),
        loadCoordinationWorkflow(careRecipientId),
      ]);

      setCurrentUserId(userId);
      setTasks(taskRows);
      setCompletions(completionRows);
      setRoster(team);
      setHandoffs(handoffRows);
      setAcknowledgements(acknowledgementRows);
      setShifts(schedule.shifts);
      setAvailability(schedule.availability);
      setAttendance(attendanceRows);
      setAgenda(agendaRows);
      setCommunications(communicationRows);
      setHandoffMedicationRecords(medicationRows);
      setWorkflow(workflowRows);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not load the caregiver shift board.",
      );
    } finally {
      setLoading(false);
    }
  }, [careRecipientId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!careRecipientId) return;

    const channel = supabase
      .channel(`care-shift-board:${careRecipientId}`)
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
          table: "care_task_completions",
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "care_shift_handoffs",
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "care_shift_handoff_acknowledgements",
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
          table: "care_shift_attendance",
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
          table: "care_coordination_resolutions",
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
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "medication_records",
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [careRecipientId, refresh]);

  const members = useMemo(() => {
    const rows =
      roster?.members.filter(
        (member) =>
          member.status === "active" &&
          (member.role === "owner" || member.role === "caregiver"),
      ) ?? [];

    if (
      currentUserId &&
      state.accessRole !== "viewer" &&
      !rows.some((member) => member.userId === currentUserId)
    ) {
      return [
        {
          userId: currentUserId,
          displayName: state.name || "Me",
          email: "",
          role: state.accessRole,
          status: "active",
          invitedAt: null,
          acceptedAt: null,
          revokedAt: null,
          isCurrentUser: true,
        } as CareTeamMember,
        ...rows,
      ];
    }

    return rows;
  }, [currentUserId, roster, state.accessRole, state.name]);

  const memberMap = useMemo(
    () => new Map((roster?.members ?? members).map((item) => [item.userId, item])),
    [members, roster],
  );

  const taskMap = useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks],
  );

  const openTasks = useMemo(
    () =>
      openTasksForShift(tasks).sort(
        (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime(),
      ),
    [tasks],
  );

  const todaysCompletions = useMemo(
    () => todayCompletions(completions),
    [completions],
  );

  const counts = useMemo(
    () => shiftBoardCounts(tasks, completions, currentUserId),
    [completions, currentUserId, tasks],
  );

  const actualCoverage = useMemo(
    () => actualCoverageNow(shifts, attendance),
    [attendance, shifts],
  );
  const coverageGaps = useMemo(
    () => uncoveredUpcomingTasks(tasks, shifts),
    [shifts, tasks],
  );

  const coordinationConflicts = useMemo(() => {
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
    () =>
      currentActionableConflicts(
        coordinationConflicts,
        workflow.resolutions,
      ),
    [coordinationConflicts, workflow.resolutions],
  );

  const nextAppointment = useMemo(
    () => nextDashboardAppointment(agenda.appointments),
    [agenda.appointments],
  );

  const briefingWindowStart = useMemo(
    () => handoffWindowStart(handoffs),
    [handoffs],
  );

  const medicationActivitySnapshot = useMemo(
    () =>
      handoffMedicationActivity(
        handoffMedicationRecords,
        briefingWindowStart,
      ),
    [briefingWindowStart, handoffMedicationRecords],
  );

  const communicationSnapshot = useMemo(
    () =>
      handoffCommunicationActivity(
        communications,
        briefingWindowStart,
      ),
    [briefingWindowStart, communications],
  );

  const coordinationSnapshot = useMemo(
    () => handoffCoordinationActivity(actionableCoordination),
    [actionableCoordination],
  );

  const nextAppointmentSnapshot = useMemo(
    () => handoffAppointmentSnapshot(nextAppointment),
    [nextAppointment],
  );

  const followUpSnapshot = useMemo(
    () => handoffFollowUps(communications),
    [communications],
  );

  const briefingCounts = useMemo(
    () =>
      handoffBriefingCounts({
        openTasks,
        completedTasks: todaysCompletions,
        medications: medicationActivitySnapshot,
        communications: communicationSnapshot,
        coordination: coordinationSnapshot,
        followUps: followUpSnapshot,
        nextAppointment: nextAppointmentSnapshot,
      }),
    [
      communicationSnapshot,
      coordinationSnapshot,
      followUpSnapshot,
      medicationActivitySnapshot,
      nextAppointmentSnapshot,
      openTasks,
      todaysCompletions,
    ],
  );

  const acknowledgementMap = useMemo(
    () =>
      new Map(
        acknowledgements.map((acknowledgement) => [
          acknowledgement.handoffId,
          acknowledgement,
        ]),
      ),
    [acknowledgements],
  );

  const pendingTakeover = useMemo(
    () =>
      latestAcceptableHandoff({
        handoffs,
        acknowledgements,
        currentUserId,
        readOnly,
      }),
    [acknowledgements, currentUserId, handoffs, readOnly],
  );

  const takeoverWork = useMemo(
    () => takeoverResponsibilities(tasks, currentUserId),
    [currentUserId, tasks],
  );

  const coverage = useMemo(() => {
    const rows = members.map((member) => {
      const assigned = openTasks.filter(
        (task) => task.assignedTo === member.userId,
      );
      return {
        member,
        open: assigned.length,
        overdue: assigned.filter(
          (task) => shiftTaskBucket(task) === "overdue",
        ).length,
        dueToday: assigned.filter((task) => {
          const bucket = shiftTaskBucket(task);
          return bucket === "due_soon" || bucket === "later_today";
        }).length,
      };
    });

    const unassigned = openTasks.filter((task) => !task.assignedTo);
    return {
      rows,
      unassigned: {
        open: unassigned.length,
        overdue: unassigned.filter(
          (task) => shiftTaskBucket(task) === "overdue",
        ).length,
      },
    };
  }, [members, openTasks]);

  function memberName(userId: string | null) {
    if (!userId) return "Shared care team";
    const member = memberMap.get(userId);
    if (!member) return "Caregiver";
    return member.isCurrentUser
      ? `${member.displayName || "Me"} (me)`
      : member.displayName || "Caregiver";
  }

  async function complete(task: CareTask) {
    if (!careRecipientId || readOnly || busyId) return;

    setBusyId(task.id);
    setMessage("");
    try {
      await completeCareTask(careRecipientId, task.id, "");
      await refresh();
      setMessage(
        task.recurrence === "none"
          ? "Task completed."
          : "Occurrence completed and the next one was scheduled.",
      );
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

  async function reassign(taskId: string, userId: string | null) {
    if (!careRecipientId || readOnly || busyId) return;

    setBusyId(taskId);
    setMessage("");
    try {
      await reassignCareTask(careRecipientId, taskId, userId);
      setReassigningId(null);
      await refresh();
      setMessage(
        userId
          ? `Responsibility reassigned to ${memberName(userId)}.`
          : "Task returned to shared responsibility.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not reassign this task.",
      );
    } finally {
      setBusyId(null);
    }
  }

  function openHandoff() {
    setShiftLabel(defaultShiftLabel());
    setHandoffNote("");
    setHandoffTo(null);
    setHandoffOpen(true);
    setMessage("");
  }

  async function saveHandoff() {
    if (!careRecipientId || readOnly || busyId) return;

    setBusyId("handoff");
    setMessage("");
    try {
      const openSnapshot = openTasks.map((task) =>
        shiftSnapshotTask(task, memberName(task.assignedTo)),
      );
      const completedSnapshot = todaysCompletions.map((completion) =>
        shiftSnapshotCompletion(
          completion,
          taskMap.get(completion.taskId)?.title || "Care task",
          memberName(completion.completedBy),
        ),
      );

      await createCareShiftHandoff({
        careRecipientId,
        handoffTo,
        shiftLabel,
        note: handoffNote,
        openTaskSnapshot: openSnapshot,
        completedTaskSnapshot: completedSnapshot,
        briefingWindowStart,
        medicationActivitySnapshot,
        communicationSnapshot,
        coordinationSnapshot,
        nextAppointmentSnapshot,
        followUpSnapshot,
      });

      setHandoffOpen(false);
      setHandoffNote("");
      setHandoffTo(null);
      await refresh();
      setMessage("Caregiver shift briefing saved and shared.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not save this handoff.",
      );
    } finally {
      setBusyId(null);
    }
  }

  if (!careRecipientId) {
    return (
      <Page>
        <Heading
          eyebrow="CAREGIVER SHIFT BOARD"
          title="Choose a care profile first."
          body="The shift board follows one shared care profile at a time."
        />
      </Page>
    );
  }

  return (
    <Page>
      <Heading
        eyebrow="TODAY · CAREGIVER SHIFT BOARD"
        title="See what needs attention, who owns it, and what changed."
        body="A focused command center for today’s responsibilities, coverage, and Caregiver Handoff 2.0 shift briefings."
      />

      <Card style={{ backgroundColor: C.deep, borderWidth: 0 }}>
        <Text style={[S.eyebrow, { color: "#E7CFEF" }]}>ACTIVE CARE PROFILE</Text>
        <Text style={[S.h2, { color: C.white }]}>
          {state.careRecipientName || "Care profile"}
        </Text>
        <Txt style={{ color: "#E9DDED" }}>
          {state.accessRole === "owner"
            ? "Owner"
            : state.accessRole === "caregiver"
              ? "Caregiver"
              : "Viewer"}{" "}
          access · {counts.open} open responsibilities
        </Txt>
      </Card>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {[
          ["Overdue", counts.overdue, "warning-outline"],
          ["Due soon", counts.dueSoon, "time-outline"],
          ["Due today", counts.dueToday, "today-outline"],
          ["Completed today", counts.completedToday, "checkmark-done-outline"],
        ].map(([label, value, icon]) => (
          <Card
            key={String(label)}
            style={{ flex: 1, minWidth: 125, padding: 15 }}
          >
            <Icon name={String(icon)} size={20} />
            <Text style={[S.h2, { fontSize: 22 }]}>{String(value)}</Text>
            <Txt style={S.small}>{String(label)}</Txt>
          </Card>
        ))}
      </View>

      {Boolean(message) && (
        <Card>
          <Text accessibilityRole="alert" style={S.body}>
            {message}
          </Text>
        </Card>
      )}

      {readOnly && (
        <Card style={{ backgroundColor: C.lavender }}>
          <Icon name="eye-outline" />
          <Text style={S.h3}>Viewer access is read-only.</Text>
          <Txt>
            You can follow today’s coverage and handoffs, but only an Owner or
            Caregiver can complete, reassign, or create shift handoffs.
          </Txt>
        </Card>
      )}

      {pendingTakeover && (
        <>
          <Section title="Handoff waiting for your acknowledgement" />
          <Card
            style={{
              borderColor: "#D7C3E1",
              backgroundColor: "#FBF8FC",
            }}
          >
            <View style={S.between}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={S.eyebrow}>CAREGIVER TAKEOVER</Text>
                <Text style={S.h2}>{pendingTakeover.shiftLabel}</Text>
                <Txt style={S.small}>
                  From {memberName(pendingTakeover.createdBy)} ·{" "}
                  {new Date(pendingTakeover.createdAt).toLocaleString()}
                </Txt>
              </View>
              <Icon name="hand-left-outline" size={28} />
            </View>

            {Boolean(pendingTakeover.note) && (
              <Card style={{ backgroundColor: C.white, padding: 13 }}>
                <Text style={[S.h3, { fontSize: 13 }]}>Outgoing caregiver note</Text>
                <Txt>{pendingTakeover.note}</Txt>
              </Card>
            )}

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <View style={[S.pill, { backgroundColor: C.lavender }]}>
                <Txt style={S.small}>
                  {pendingTakeover.openTaskSnapshot.length} unfinished
                </Txt>
              </View>
              <View style={[S.pill, { backgroundColor: C.lavender }]}>
                <Txt style={S.small}>
                  {pendingTakeover.medicationActivitySnapshot.length} medication
                </Txt>
              </View>
              <View style={[S.pill, { backgroundColor: C.lavender }]}>
                <Txt style={S.small}>
                  {pendingTakeover.communicationSnapshot.length} communication
                </Txt>
              </View>
              <View style={[S.pill, { backgroundColor: C.lavender }]}>
                <Txt style={S.small}>
                  {pendingTakeover.coordinationSnapshot.length} coordination
                </Txt>
              </View>
            </View>

            {pendingTakeover.nextAppointmentSnapshot && (
              <Txt>
                Next recorded visit:{" "}
                <Text style={S.h3}>
                  {pendingTakeover.nextAppointmentSnapshot.title}
                </Text>{" "}
                ·{" "}
                {new Date(
                  pendingTakeover.nextAppointmentSnapshot.startsAt,
                ).toLocaleString()}
              </Txt>
            )}

            <Card style={{ backgroundColor: C.white }}>
              <View style={S.between}>
                <Text style={S.h3}>Your live responsibilities now</Text>
                <Icon name="checkbox-outline" size={20} />
              </View>
              <Txt>
                {takeoverWork.mine.length} assigned to you ·{" "}
                {takeoverWork.shared.length} shared / unassigned
              </Txt>

              {takeoverWork.mine.slice(0, 4).map((task) => (
                <Txt key={task.id} style={S.small}>
                  • Yours: {task.title} · due{" "}
                  {new Date(task.dueAt).toLocaleString()}
                </Txt>
              ))}

              {takeoverWork.shared.slice(0, 4).map((task) => (
                <Txt key={task.id} style={S.small}>
                  • Shared: {task.title} · due{" "}
                  {new Date(task.dueAt).toLocaleString()}
                </Txt>
              ))}

              {!takeoverWork.mine.length && !takeoverWork.shared.length && (
                <Txt style={S.small}>
                  No open responsibilities are currently assigned to you or left
                  shared.
                </Txt>
              )}

              <Txt style={S.small}>
                Accepting this handoff records the takeover only. It does not
                reassign tasks that already belong to another caregiver.
              </Txt>
            </Card>

            <Field
              label="Acknowledgement note (optional)"
              value={takeoverNote}
              onChange={(value) => setTakeoverNote(value.slice(0, 2000))}
              multiline
            />

            <Button
              title={
                busyId === `takeover:${pendingTakeover.id}`
                  ? "Confirming takeover…"
                  : "I’ve reviewed this briefing · Accept takeover"
              }
              disabled={Boolean(busyId)}
              icon="checkmark-circle-outline"
              onPress={() => void acceptTakeover()}
            />

            <Txt style={S.small}>
              Your acceptance time is recorded by EnVizion when you confirm.
              The acknowledgement cannot be edited or deleted from the app.
            </Txt>
          </Card>
        </>
      )}

      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Button
            title="Full care plan"
            secondary
            icon="checkbox-outline"
            onPress={() => n.navigate("CareTasks")}
          />
        </View>
        {!readOnly && (
          <View style={{ flex: 1 }}>
            <Button
              title="Create shift briefing"
              icon="swap-horizontal-outline"
              onPress={openHandoff}
            />
          </View>
        )}
      </View>

      <Button
        title="Availability & shift schedule"
        secondary
        icon="calendar-outline"
        onPress={() => n.navigate("CareSchedule")}
      />
      <Button
        title="Weekly care coordination analytics"
        secondary
        icon="bar-chart-outline"
        onPress={() => n.navigate("CareAnalytics")}
      />

      <Card
        style={{
          backgroundColor:
            actualCoverage.missingCheckIn.length || coverageGaps.length
              ? "#FFF9F2"
              : "#EAF4EF",
        }}
      >
        <Icon
          name={
            actualCoverage.missingCheckIn.length || coverageGaps.length
              ? "warning-outline"
              : "shield-checkmark-outline"
          }
          color={
            actualCoverage.missingCheckIn.length || coverageGaps.length
              ? C.rose
              : C.purple
          }
        />
        <Text style={S.h3}>
          {actualCoverage.scheduledNow.length
            ? `${actualCoverage.checkedInNow.length}/${actualCoverage.scheduledNow.length} scheduled caregiver${actualCoverage.scheduledNow.length === 1 ? "" : "s"} checked in now`
            : "No caregiver shift is scheduled right now"}
        </Text>
        <Txt>
          {actualCoverage.missingCheckIn.length
            ? `${actualCoverage.missingCheckIn.length} active shift${actualCoverage.missingCheckIn.length === 1 ? "" : "s"} still have no “I’m here” confirmation.`
            : coverageGaps.length
              ? `${coverageGaps.length} upcoming task${coverageGaps.length === 1 ? "" : "s"} have no matching scheduled coverage in the next 7 days.`
              : "Scheduled and actual coverage are aligned right now."}
        </Txt>
      </Card>

      {actualCoverage.scheduledNow.length > 0 && (
        <>
          <Section title="Actual shift attendance now" />
          {actualCoverage.scheduledNow.map((shift) => {
            const item = attendanceForShift(shift.id, attendance);
            const checkedIn = Boolean(item?.status === "active");
            return (
              <Card
                key={shift.id}
                style={{
                  borderColor: checkedIn ? C.line : "#E8BDC3",
                  backgroundColor: checkedIn ? C.white : "#FFF9F8",
                }}
              >
                <View style={S.between}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={S.h3}>{shift.label}</Text>
                    <Txt>{memberName(shift.caregiverId)}</Txt>
                  </View>
                  <View
                    style={[
                      S.pill,
                      {
                        backgroundColor: checkedIn ? "#EAF4EF" : C.redBg,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        S.small,
                        {
                          color: checkedIn ? C.deep : C.rose,
                          fontFamily: "DMSans_600SemiBold",
                        },
                      ]}
                    >
                      {checkedIn ? "Checked in" : "No check-in"}
                    </Text>
                  </View>
                </View>
                {item && (
                  <Txt style={S.small}>
                    Since {new Date(item.checkedInAt).toLocaleTimeString()} ·{" "}
                    {attendanceDurationMinutes(item)} min active
                    {item.lateMinutes
                      ? ` · ${item.lateMinutes} min late`
                      : " · On time"}
                  </Txt>
                )}
                {!item && (
                  <Txt style={{ color: C.rose }}>
                    Verify actual coverage directly if this shift has already
                    started.
                  </Txt>
                )}
              </Card>
            );
          })}
        </>
      )}

      {handoffOpen && !readOnly && (
        <>
          <Section title="Create Caregiver Handoff 2.0 briefing" />
          <Card>
            <Field
              label="Handoff label"
              value={shiftLabel}
              onChange={setShiftLabel}
            />
            <Field
              label="What should the next caregiver know?"
              value={handoffNote}
              onChange={(value) => setHandoffNote(value.slice(0, 4000))}
              multiline
            />

            <Text style={S.h3}>Send handoff to</Text>
            <MemberChoice
              title="Whole active care team"
              subtitle="Everyone with Owner or Caregiver access can see it."
              selected={handoffTo === null}
              disabled={busyId === "handoff"}
              onPress={() => setHandoffTo(null)}
            />
            {members.map((member) => (
              <MemberChoice
                key={member.userId}
                title={
                  member.isCurrentUser
                    ? `${member.displayName || "Me"} · Me`
                    : member.displayName || "Caregiver"
                }
                subtitle={member.role === "owner" ? "Care owner" : "Caregiver"}
                selected={handoffTo === member.userId}
                disabled={busyId === "handoff"}
                onPress={() => setHandoffTo(member.userId)}
              />
            ))}

            <Card style={{ backgroundColor: "#F8F4F9" }}>
              <View style={S.between}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={S.h3}>Shift briefing preview</Text>
                  <Txt style={S.small}>
                    Since {new Date(briefingWindowStart).toLocaleString()}
                  </Txt>
                </View>
                <Icon name="reader-outline" />
              </View>

              <Txt>
                {briefingCounts.openTasks} unfinished task
                {briefingCounts.openTasks === 1 ? "" : "s"} ·{" "}
                {briefingCounts.completedTasks} completed today
              </Txt>
              <Txt>
                {briefingCounts.medications} medication activit
                {briefingCounts.medications === 1 ? "y" : "ies"} ·{" "}
                {briefingCounts.communications} new communication
                {briefingCounts.communications === 1 ? "" : "s"}
              </Txt>
              <Txt>
                {briefingCounts.coordination} unresolved coordination item
                {briefingCounts.coordination === 1 ? "" : "s"} ·{" "}
                {briefingCounts.followUps} follow-up
                {briefingCounts.followUps === 1 ? "" : "s"}
              </Txt>
              <Txt>
                {briefingCounts.hasNextAppointment
                  ? `Next visit: ${nextAppointmentSnapshot?.title} · ${new Date(
                      nextAppointmentSnapshot!.startsAt,
                    ).toLocaleString()}`
                  : "No upcoming appointment is currently recorded."}
              </Txt>

              {communicationSnapshot.slice(0, 2).map((item) => (
                <Txt key={item.id} style={S.small}>
                  • Communication: {item.summary}
                </Txt>
              ))}
              {coordinationSnapshot.slice(0, 2).map((item) => (
                <Txt key={item.id} style={S.small}>
                  • Coordination: {item.title}
                </Txt>
              ))}
              {followUpSnapshot.slice(0, 2).map((item) => (
                <Txt key={item.id} style={S.small}>
                  • Follow-up: {item.summary} ·{" "}
                  {new Date(item.followUpAt).toLocaleString()}
                </Txt>
              ))}

              <Txt style={S.small}>
                Saving freezes this point-in-time briefing. The live care plan
                remains the source for current status after the handoff.
              </Txt>
            </Card>

            <Button
              title={
                busyId === "handoff"
                  ? "Saving briefing…"
                  : "Save and share shift briefing"
              }
              disabled={busyId === "handoff" || !shiftLabel.trim()}
              onPress={() => void saveHandoff()}
            />
            <Button
              title="Cancel"
              secondary
              disabled={busyId === "handoff"}
              onPress={() => setHandoffOpen(false)}
            />
          </Card>
        </>
      )}

      <Section title="Coverage by caregiver" />
      {loading ? (
        <Card>
          <ActivityIndicator color={C.purple} />
          <Txt>Loading today’s coverage…</Txt>
        </Card>
      ) : (
        <>
          {coverage.rows.map(({ member, open, overdue, dueToday }) => (
            <Card key={member.userId}>
              <View style={S.between}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={S.h3}>
                    {member.isCurrentUser
                      ? `${member.displayName || "Me"} · You`
                      : member.displayName || "Caregiver"}
                  </Text>
                  <Txt style={S.small}>
                    {member.role === "owner" ? "Care owner" : "Caregiver"}
                  </Txt>
                </View>
                <View
                  style={[
                    S.pill,
                    { backgroundColor: overdue ? C.redBg : C.lavender },
                  ]}
                >
                  <Text
                    style={[
                      S.small,
                      {
                        color: overdue ? C.rose : C.deep,
                        fontFamily: "DMSans_600SemiBold",
                      },
                    ]}
                  >
                    {open} open
                  </Text>
                </View>
              </View>
              <Txt>
                {dueToday} due today
                {overdue ? ` · ${overdue} overdue` : ""}
              </Txt>
            </Card>
          ))}

          {coverage.unassigned.open > 0 && (
            <Card style={{ backgroundColor: "#FFF9F2" }}>
              <Icon name="people-outline" />
              <Text style={S.h3}>Shared / unassigned responsibility</Text>
              <Txt>
                {coverage.unassigned.open} open task
                {coverage.unassigned.open === 1 ? "" : "s"}
                {coverage.unassigned.overdue
                  ? ` · ${coverage.unassigned.overdue} overdue`
                  : ""}
              </Txt>
            </Card>
          )}
        </>
      )}

      <Section title="Today’s responsibility queue" action="Refresh" onPress={() => void refresh()} />

      {!loading && !openTasks.length ? (
        <Card>
          <Icon name="checkmark-done-circle-outline" size={30} />
          <Text style={S.h3}>No open care tasks.</Text>
          <Txt>The shared care plan is clear right now.</Txt>
        </Card>
      ) : (
        openTasks.map((task) => {
          const bucket = shiftTaskBucket(task);
          const busy = busyId === task.id;

          return (
            <Card
              key={task.id}
              style={{
                borderColor: bucket === "overdue" ? "#E8BDC3" : C.line,
                backgroundColor: bucket === "overdue" ? "#FFF9F8" : C.white,
              }}
            >
              <View style={S.between}>
                <View style={{ flex: 1, gap: 7 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: 7,
                    }}
                  >
                    <View
                      style={[
                        S.pill,
                        { backgroundColor: bucketBackground(bucket) },
                      ]}
                    >
                      <Text
                        style={[
                          S.small,
                          {
                            color: bucket === "overdue" ? C.rose : C.deep,
                            fontFamily: "DMSans_600SemiBold",
                          },
                        ]}
                      >
                        {bucketLabels[bucket]}
                      </Text>
                    </View>
                    <View
                      style={[
                        S.pill,
                        {
                          backgroundColor:
                            task.priority === "high"
                              ? "#FDE9EC"
                              : task.priority === "important"
                                ? "#FFF1E5"
                                : "#EEF3F1",
                        },
                      ]}
                    >
                      <Text style={[S.small, { color: C.deep }]}>
                        {careTaskPriorityLabels[task.priority]}
                      </Text>
                    </View>
                  </View>
                  <Text style={S.h2}>{task.title}</Text>
                </View>
              </View>

              {Boolean(task.details) && <Txt>{task.details}</Txt>}

              <Txt style={S.small}>
                Due {new Date(task.dueAt).toLocaleString()} ·{" "}
                {careTaskCategoryLabels[task.category]} ·{" "}
                {careTaskRecurrenceLabels[task.recurrence]}
              </Txt>
              <Txt>
                Responsibility: <Text style={S.h3}>{memberName(task.assignedTo)}</Text>
              </Txt>

              {!readOnly && reassigningId !== task.id && (
                <View style={{ flexDirection: "row", gap: 9 }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      title={busy ? "Updating…" : "Complete"}
                      secondary
                      icon="checkmark-circle-outline"
                      disabled={Boolean(busyId)}
                      onPress={() => void complete(task)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Reassign"
                      secondary
                      icon="swap-horizontal-outline"
                      disabled={Boolean(busyId)}
                      onPress={() => setReassigningId(task.id)}
                    />
                  </View>
                </View>
              )}

              {!readOnly && reassigningId === task.id && (
                <Card style={{ backgroundColor: C.lavender }}>
                  <Text style={S.h3}>Reassign responsibility</Text>
                  <MemberChoice
                    title="Shared care team"
                    subtitle="No single caregiver owns this task."
                    selected={task.assignedTo === null}
                    disabled={busy}
                    onPress={() => void reassign(task.id, null)}
                  />
                  {members.map((member) => (
                    <MemberChoice
                      key={member.userId}
                      title={
                        member.isCurrentUser
                          ? `${member.displayName || "Me"} · Me`
                          : member.displayName || "Caregiver"
                      }
                      subtitle={
                        member.role === "owner" ? "Care owner" : "Caregiver"
                      }
                      selected={task.assignedTo === member.userId}
                      disabled={busy}
                      onPress={() => void reassign(task.id, member.userId)}
                    />
                  ))}
                  <Button
                    title="Cancel"
                    secondary
                    disabled={busy}
                    onPress={() => setReassigningId(null)}
                  />
                </Card>
              )}
            </Card>
          );
        })
      )}

      <Section title="Completed today" />
      {todaysCompletions.length ? (
        todaysCompletions.slice(0, 20).map((completion) => (
          <Card key={completion.id}>
            <View style={S.row}>
              <Icon name="checkmark-circle-outline" />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={S.h3}>
                  {taskMap.get(completion.taskId)?.title || "Care task"}
                </Text>
                <Txt style={S.small}>
                  {new Date(completion.completedAt).toLocaleString()} ·{" "}
                  {memberName(completion.completedBy)}
                </Txt>
                {Boolean(completion.note) && <Txt>{completion.note}</Txt>}
              </View>
            </View>
          </Card>
        ))
      ) : (
        <Card>
          <Txt>No task completions have been recorded today yet.</Txt>
        </Card>
      )}

      <Section title="Recent caregiver handoffs" />
      {handoffs.length ? (
        handoffs.slice(0, 12).map((handoff) => (
          <Card key={handoff.id}>
            <View style={S.between}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={S.h3}>{handoff.shiftLabel}</Text>
                <Txt style={S.small}>
                  {new Date(handoff.createdAt).toLocaleString()} · From{" "}
                  {memberName(handoff.createdBy)}
                  {handoff.handoffTo
                    ? ` · To ${memberName(handoff.handoffTo)}`
                    : " · Shared with care team"}
                </Txt>
              </View>
              <Icon name="swap-horizontal-outline" />
            </View>

            {Boolean(handoff.note) && <Txt>{handoff.note}</Txt>}

            <Txt style={S.small}>
              {handoff.briefingVersion >= 2 ? "Shift briefing" : "Snapshot"} ·{" "}
              {handoff.openTaskSnapshot.length} unfinished ·{" "}
              {handoff.completedTaskSnapshot.length} completed
              {handoff.briefingVersion >= 2
                ? ` · ${handoff.medicationActivitySnapshot.length} medication · ${handoff.communicationSnapshot.length} communication · ${handoff.coordinationSnapshot.length} coordination · ${handoff.followUpSnapshot.length} follow-up`
                : ""}
            </Txt>

            {handoff.briefingVersion >= 2 && handoff.briefingWindowStart && (
              <Txt style={S.small}>
                Briefing window started{" "}
                {new Date(handoff.briefingWindowStart).toLocaleString()}.
              </Txt>
            )}

            {handoff.nextAppointmentSnapshot && (
              <Card style={{ backgroundColor: "#F8F4F9", padding: 13 }}>
                <View style={S.row}>
                  <Icon name="calendar-outline" size={18} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[S.h3, { fontSize: 13 }]}>
                      Next visit · {handoff.nextAppointmentSnapshot.title}
                    </Text>
                    <Txt style={S.small}>
                      {new Date(
                        handoff.nextAppointmentSnapshot.startsAt,
                      ).toLocaleString()}
                      {handoff.nextAppointmentSnapshot.location
                        ? ` · ${handoff.nextAppointmentSnapshot.location}`
                        : ""}
                    </Txt>
                  </View>
                </View>
              </Card>
            )}

            {handoff.openTaskSnapshot.slice(0, 3).map((item, index) => (
              <Txt key={String(item.id ?? index)} style={S.small}>
                • Unfinished: {String(item.title ?? "Care task")} ·{" "}
                {String(item.assigneeName ?? "Shared care team")}
              </Txt>
            ))}

            {handoff.medicationActivitySnapshot.slice(0, 3).map((item) => (
              <Txt key={item.id} style={S.small}>
                • Medication record: {item.medicationName} ·{" "}
                {new Date(item.recordedAt).toLocaleString()}
                {item.correctedAt ? " · corrected/withdrawn" : ""}
              </Txt>
            ))}

            {handoff.communicationSnapshot.slice(0, 3).map((item) => (
              <Txt key={item.id} style={S.small}>
                • Communication: {item.summary}
                {item.organizationName ? ` · ${item.organizationName}` : ""}
              </Txt>
            ))}

            {handoff.coordinationSnapshot.slice(0, 3).map((item) => (
              <Txt key={item.id} style={S.small}>
                • Coordination: {item.title}
                {item.priority === "time_sensitive" ? " · time-sensitive" : ""}
              </Txt>
            ))}

            {handoff.followUpSnapshot.slice(0, 3).map((item) => (
              <Txt key={item.id} style={S.small}>
                • Needs follow-up: {item.summary} ·{" "}
                {new Date(item.followUpAt).toLocaleString()}
              </Txt>
            ))}

            {handoff.openTaskSnapshot.length > 3 && (
              <Txt style={S.small}>
                + {handoff.openTaskSnapshot.length - 3} more unfinished task
                {handoff.openTaskSnapshot.length - 3 === 1 ? "" : "s"}
              </Txt>
            )}
          </Card>
        ))
      ) : (
        <Card>
          <Icon name="swap-horizontal-outline" />
          <Text style={S.h3}>No caregiver handoffs yet.</Text>
          <Txt>
            Caregiver Handoff 2.0 freezes unfinished work, recent medication
            activity, communication, coordination, follow-ups, and the next
            recorded appointment so the incoming caregiver can review one
            point-in-time briefing.
          </Txt>
        </Card>
      )}

      <Card style={{ backgroundColor: C.lavender }}>
        <Icon name="shield-checkmark-outline" />
        <Text style={S.h3}>Coordination alerts are not emergency monitoring.</Text>
        <Txt>
          Due-soon and overdue notices help caregivers coordinate responsibilities.
          They can be delayed, muted, or unavailable and must not be used to
          determine whether urgent medical care is needed.
        </Txt>
      </Card>
    </Page>
  );
}
