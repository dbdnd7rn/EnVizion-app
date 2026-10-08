import { design } from "../design";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, Platform, Pressable, Text, View } from "react-native";
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from "react-native-svg";
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
import { useCarePresence } from "../CarePresenceProvider";
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


function ShiftReveal({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;
    let animation: Animated.CompositeAnimation | null = null;

    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!active) return;
      if (reduced) {
        progress.setValue(1);
        return;
      }

      animation = Animated.timing(progress, {
        toValue: 1,
        duration: 460,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== "web",
      });
      animation.start();
    });

    return () => {
      active = false;
      animation?.stop();
    };
  }, [delay, progress]);

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [18, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

function ShiftFloat({ children }: { children: React.ReactNode }) {
  const y = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;
    let animation: Animated.CompositeAnimation | null = null;

    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!active || reduced) return;

      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(y, {
            toValue: -6,
            duration: 1700,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: Platform.OS !== "web",
          }),
          Animated.timing(y, {
            toValue: 0,
            duration: 1700,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: Platform.OS !== "web",
          }),
        ]),
      );
      animation.start();
    });

    return () => {
      active = false;
      animation?.stop();
    };
  }, [y]);

  return (
    <Animated.View style={{ transform: [{ translateY: y }] }}>
      {children}
    </Animated.View>
  );
}

function ShiftHeroGraphic() {
  return (
    <View style={{ width: 190, height: 176 }}>
      <Svg width="100%" height="100%" viewBox="0 0 190 176">
        <Defs>
          <LinearGradient id="boardPurple" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#9D5BDC" />
            <Stop offset="1" stopColor="#6530A2" />
          </LinearGradient>
          <LinearGradient id="boardRed" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FF777D" />
            <Stop offset="1" stopColor="#F43E56" />
          </LinearGradient>
        </Defs>

        <Path
          d="M61 19 C94 -7 155 6 179 45 C200 80 183 129 150 150 C117 172 65 158 45 127 C23 93 28 45 61 19 Z"
          fill="#F0E8FD"
        />
        <Circle cx="169" cy="42" r="2.8" fill="#B07DDF" />
        <Circle cx="151" cy="25" r="2.2" fill="#C196EA" />
        <Circle cx="176" cy="67" r="2.2" fill="#C196EA" />

        <G transform="translate(29 93) rotate(-25)">
          <Ellipse cx="8" cy="23" rx="8" ry="29" fill="#8D55CA" />
          <Ellipse cx="22" cy="19" rx="7" ry="27" fill="#B184E8" />
          <Ellipse cx="35" cy="17" rx="6" ry="23" fill="#D0B5F6" />
        </G>

        <G transform="translate(63 30)">
          <Rect x="16" y="20" width="95" height="115" rx="19" fill="#C6AAEE" opacity="0.45" />
          <Rect x="8" y="13" width="99" height="116" rx="19" fill="#FFFFFF" stroke="#E5DDF1" strokeWidth="1.4" />
          <Rect x="8" y="13" width="99" height="30" rx="19" fill="url(#boardPurple)" />
          <Rect x="36" y="3" width="43" height="23" rx="7" fill="#6B32A5" />
          <Rect x="45" y="9" width="25" height="6" rx="3" fill="#D9C7F4" />

          <Rect x="23" y="55" width="20" height="20" rx="5" fill="#8A43C3" />
          <Path d="M28 64 L33 69 L40 60" stroke="#FFFFFF" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Rect x="52" y="57" width="37" height="6" rx="3" fill="#D9D2E8" />
          <Rect x="52" y="68" width="29" height="5" rx="2.5" fill="#ECE7F2" />

          <Rect x="23" y="86" width="20" height="20" rx="5" fill="#8A43C3" />
          <Path d="M28 95 L33 100 L40 91" stroke="#FFFFFF" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Rect x="52" y="88" width="43" height="6" rx="3" fill="#D9D2E8" />
          <Rect x="52" y="99" width="31" height="5" rx="2.5" fill="#ECE7F2" />

          <Rect x="23" y="117" width="20" height="20" rx="5" fill="#D5C9EA" />
          <Path d="M28 126 L33 131 L40 122" stroke="#FFFFFF" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Rect x="52" y="119" width="39" height="6" rx="3" fill="#D9D2E8" />
          <Rect x="52" y="130" width="26" height="5" rx="2.5" fill="#ECE7F2" />
        </G>

        <G transform="translate(12 52)">
          <Path d="M38 30 C22 18 18 7 26 2 C34 -2 39 6 39 6 C39 6 45 -2 53 2 C62 7 57 19 38 30 Z" fill="url(#boardRed)" />
          <Path d="M49 25 L53 34 L43 29 Z" fill="#F55367" />
        </G>

        <G transform="translate(130 111)">
          <Circle cx="28" cy="28" r="27" fill="#5D248D" />
          <Circle cx="28" cy="28" r="20" fill="#F3EAFB" />
          <Path d="M28 14 V28 L37 31" stroke="#5D248D" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx="28" cy="28" r="3.2" fill="#5D248D" />
        </G>
      </Svg>
    </View>
  );
}

function ShiftMiniGraphic({ kind }: { kind: "tasks" | "handoffs" | "clear" }) {
  if (kind === "clear") {
    return (
      <View
        style={{
          width: 76,
          height: 76,
          borderRadius: 38,
          backgroundColor: "#DDF7E6",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name="shield-checkmark" size={40} color="#1AAA62" />
      </View>
    );
  }

  return (
    <View
      style={{
        width: 86,
        height: 76,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          position: "absolute",
          width: 66,
          height: 66,
          borderRadius: 22,
          backgroundColor: "#EFE5FB",
          transform: [{ rotate: kind === "tasks" ? "8deg" : "-7deg" }],
        }}
      />
      <View
        style={{
          width: 54,
          height: 63,
          borderRadius: 12,
          backgroundColor: "#FFFFFF",
          borderWidth: 1,
          borderColor: "#E5DDEF",
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#5B3D72",
          shadowOpacity: 0.06,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        }}
      >
        <Icon
          name={kind === "tasks" ? "checkmark-done-outline" : "swap-horizontal-outline"}
          size={28}
          color="#8241B2"
        />
      </View>
      <View
        style={{
          position: "absolute",
          right: 0,
          bottom: 7,
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: "#8742C0",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon
          name={kind === "tasks" ? "checkmark" : "arrow-forward"}
          size={17}
          color="#FFFFFF"
        />
      </View>
    </View>
  );
}

function ShiftTab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 49,
        borderRadius: 25,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: active ? "#7D36B0" : "#F4F1F6",
        opacity: pressed ? 0.76 : 1,
      })}
    >
      <Text
        style={{
          fontFamily: active ? "DMSans_700Bold" : "DMSans_600SemiBold",
          fontSize: 13,
          color: active ? "#FFFFFF" : "#69647A",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function CareShiftBoardScreen() {
  const n = useNav();
  const { state } = useCare();
  const { setActivity } = useCarePresence();
  const careRecipientId = state.careRecipientId;
  const readOnly =
    state.accessRole === "viewer" || state.accessRole === "patient";

  useEffect(() => {
    setActivity({
      mode: "handoff_review",
      screenKey: "shift_board",
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
  const [activeTab, setActiveTab] = useState<"today" | "completed" | "handoffs">("today");
  const [showCoverageDetails, setShowCoverageDetails] = useState(false);
  const [expandedHandoffId, setExpandedHandoffId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
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
        state.accessRole !== "patient" &&
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

  async function acceptTakeover(flagConcern = false) {
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
        concernFlagged: flagConcern,
        concernText: flagConcern ? takeoverNote : "",
        reviewedUrgentItems: true,
      });

      setTakeoverNote("");
      await refresh();
      setMessage(
        flagConcern
          ? `Takeover confirmed with a flagged concern at ${new Date(
              acknowledgement.acceptedAt,
            ).toLocaleString()}. Your active caregiver shift has started and the concern remains visible in handoff history.`
          : `Takeover confirmed at ${new Date(
              acknowledgement.acceptedAt,
            ).toLocaleString()}. Your active caregiver shift has started and existing task ownership was preserved.`,
      );
      n.navigate("OnShiftCaregiver");
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

  const profileName = state.careRecipientName || "Care profile";
  const profileInitials = profileName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "CP";
  const todayLabel = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const hasCoverageIssue =
    actualCoverage.missingCheckIn.length > 0 || coverageGaps.length > 0;
  const hasCoordinationIssue =
    actionableCoordination.length > 0 || counts.overdue > 0;
  const allClear = !hasCoverageIssue && !hasCoordinationIssue;

  if (!careRecipientId) {
    return (
      <Page>
        <View style={{ gap: 16, paddingTop: 10 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => n.goBack()}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: "#F5F1F8",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="arrow-back" size={22} color="#1A1742" />
          </Pressable>
          <Text style={[S.title, { fontSize: 32, lineHeight: 38 }]}>
            Choose a care profile first.
          </Text>
          <Txt>The shift board follows one shared care profile at a time.</Txt>
        </View>
      </Page>
    );
  }

  return (
    <Page>
      <View style={{ gap: 18 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => n.goBack()}
            style={({ pressed }) => ({
              width: 46,
              height: 46,
              borderRadius: 23,
              backgroundColor: "#F6F2F9",
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.66 : 1,
            })}
          >
            <Icon name="arrow-back" size={23} color="#17143C" />
          </Pressable>

          <Text
            style={{
              flex: 1,
              fontFamily: "DMSans_700Bold",
              fontSize: 17,
              color: "#6F2EA0",
            }}
          >
            Caregiver shift board
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open notifications"
            onPress={() => n.navigate("Notifications")}
            style={({ pressed }) => ({
              width: 46,
              height: 46,
              borderRadius: 23,
              backgroundColor: "#FFFFFF",
              borderWidth: 1,
              borderColor: "#EFE8F3",
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.65 : 1,
            })}
          >
            <Icon name="notifications-outline" size={23} color="#26194A" />
            <View
              style={{
                position: "absolute",
                right: 9,
                top: 8,
                width: 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: "#F15368",
              }}
            />
          </Pressable>
        </View>

        <ShiftReveal>
          <View
            style={{
              minHeight: 258,
              position: "relative",
              overflow: "hidden",
              paddingTop: 4,
            }}
          >
            <View style={{ maxWidth: 245, gap: 10, paddingTop: 10 }}>
              <View
                style={{
                  alignSelf: "flex-start",
                  minHeight: 35,
                  borderRadius: 18,
                  paddingHorizontal: 13,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  backgroundColor: "#F4EEFB",
                }}
              >
                <Icon name="calendar-outline" size={17} color="#7F37AE" />
                <Text
                  style={{
                    fontFamily: "DMSans_600SemiBold",
                    fontSize: 11.5,
                    color: "#302653",
                  }}
                >
                  Today, {todayLabel}
                </Text>
              </View>

              <Text
                style={{
                  fontFamily: design.font.display,
                  fontSize: 38,
                  lineHeight: 42,
                  letterSpacing: -0.9,
                  color: "#11133D",
                }}
              >
                Your day,{"\n"}at a glance
              </Text>

              <Text
                style={{
                  maxWidth: 235,
                  fontFamily: "DMSans_400Regular",
                  fontSize: 14,
                  lineHeight: 21,
                  color: "#79758A",
                }}
              >
                Everything you need for a smooth and informed caregiving shift.
              </Text>
            </View>

            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                right: -11,
                top: 2,
              }}
            >
              <ShiftFloat>
                <ShiftHeroGraphic />
              </ShiftFloat>
            </View>
          </View>
        </ShiftReveal>

        <ShiftReveal delay={55}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open active care profile"
            onPress={() => n.navigate("CareTeam")}
            style={({ pressed }) => ({
              minHeight: 126,
              borderRadius: 27,
              overflow: "hidden",
              paddingHorizontal: 18,
              flexDirection: "row",
              alignItems: "center",
              gap: 16,
              backgroundColor: "#6C2A98",
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                width: 220,
                height: 220,
                borderRadius: 110,
                right: -65,
                top: -105,
                backgroundColor: "#914DC0",
                opacity: 0.55,
              }}
            />
            <View
              style={{
                width: 58,
                height: 58,
                borderRadius: 29,
                backgroundColor: "#FFFFFF",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: "DMSans_700Bold",
                  fontSize: 19,
                  color: "#6C2A98",
                }}
              >
                {profileInitials}
              </Text>
            </View>

            <View style={{ flex: 1, gap: 5 }}>
              <Text
                style={{
                  fontFamily: "DMSans_700Bold",
                  fontSize: 9.5,
                  letterSpacing: 2.5,
                  color: "#E9D9F2",
                }}
              >
                ACTIVE CARE PROFILE
              </Text>
              <Text
                style={{
                  fontFamily: "DMSans_700Bold",
                  fontSize: 23,
                  color: "#FFFFFF",
                }}
              >
                {profileName}
              </Text>
              <Text
                style={{
                  fontFamily: "DMSans_400Regular",
                  fontSize: 12.5,
                  color: "#E7DBEC",
                }}
              >
                {state.accessRole === "owner"
                  ? "Owner"
                  : state.accessRole === "caregiver"
                    ? "Caregiver"
                    : "Viewer"}{" "}
                access · {counts.open} open responsibilities
              </Text>
            </View>

            <Icon name="chevron-forward" size={24} color="#FFFFFF" />
          </Pressable>
        </ShiftReveal>

        <ShiftReveal delay={95}>
          <View
            style={{
              minHeight: 117,
              borderRadius: 26,
              backgroundColor: "#FFFFFF",
              borderWidth: 1,
              borderColor: "#ECE6F0",
              flexDirection: "row",
              alignItems: "stretch",
              overflow: "hidden",
            }}
          >
            {[
              {
                label: "Overdue",
                value: counts.overdue,
                icon: "warning-outline",
                bg: "#FFE8EA",
                color: "#CE4058",
              },
              {
                label: "Due soon",
                value: counts.dueSoon,
                icon: "time-outline",
                bg: "#F2E9FB",
                color: "#7A35A9",
              },
              {
                label: "Due today",
                value: counts.dueToday,
                icon: "calendar-outline",
                bg: "#E6F3FF",
                color: "#2776C4",
              },
              {
                label: "Completed",
                value: counts.completedToday,
                icon: "checkmark-circle-outline",
                bg: "#E5F8EB",
                color: "#209B57",
              },
            ].map((item, index) => (
              <View
                key={item.label}
                style={{
                  flex: 1,
                  paddingVertical: 15,
                  alignItems: "center",
                  justifyContent: "center",
                  borderLeftWidth: index ? 1 : 0,
                  borderLeftColor: "#EEE9F1",
                  gap: 5,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: item.bg,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name={item.icon} size={21} color={item.color} />
                </View>
                <Text
                  style={{
                    fontFamily: "DMSans_700Bold",
                    fontSize: 19,
                    color: "#14143C",
                  }}
                >
                  {item.value}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: "DMSans_400Regular",
                    fontSize: 9.5,
                    color: "#777287",
                  }}
                >
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
        </ShiftReveal>

        {Boolean(message) && (
          <ShiftReveal>
            <View
              style={{
                borderRadius: 20,
                paddingHorizontal: 15,
                paddingVertical: 12,
                backgroundColor: "#F6F1FA",
                borderWidth: 1,
                borderColor: "#E8DDF0",
              }}
            >
              <Text accessibilityRole="alert" style={[S.body, { fontSize: 12.5 }]}>
                {message}
              </Text>
            </View>
          </ShiftReveal>
        )}

        {readOnly && (
          <View
            style={{
              borderRadius: 20,
              padding: 15,
              backgroundColor: "#F4EFF9",
              flexDirection: "row",
              alignItems: "center",
              gap: 11,
            }}
          >
            <Icon name="eye-outline" size={21} color="#7A36A5" />
            <View style={{ flex: 1 }}>
              <Text style={[S.h3, { fontSize: 13 }]}>Viewer access</Text>
              <Txt style={[S.small, { fontSize: 11.5 }]}>
                You can review this board, but care actions are read-only.
              </Txt>
            </View>
          </View>
        )}

        {pendingTakeover && (
          <ShiftReveal>
            <View
              style={{
                borderRadius: 25,
                padding: 17,
                backgroundColor: "#FFF8ED",
                borderWidth: 1,
                borderColor: "#F1DFC1",
                gap: 12,
              }}
            >
              <View style={S.between}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[S.eyebrow, { color: "#9B651F" }]}>
                    TAKEOVER READY
                  </Text>
                  <Text style={[S.h2, { fontSize: 18 }]}>
                    {pendingTakeover.shiftLabel}
                  </Text>
                  <Txt style={[S.small, { fontSize: 11.5 }]}>
                    From {memberName(pendingTakeover.createdBy)} ·{" "}
                    {new Date(pendingTakeover.createdAt).toLocaleString()}
                  </Txt>
                </View>
                <Icon name="hand-left-outline" size={27} color="#9B651F" />
              </View>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                {[
                  [pendingTakeover.openTaskSnapshot.length, "unfinished"],
                  [pendingTakeover.medicationActivitySnapshot.length, "medication"],
                  [pendingTakeover.communicationSnapshot.length, "messages"],
                  [pendingTakeover.coordinationSnapshot.length, "coordination"],
                ].map(([value, label]) => (
                  <View
                    key={String(label)}
                    style={[
                      S.pill,
                      { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#F0E2CB" },
                    ]}
                  >
                    <Text style={[S.small, { color: "#6B542F" }]}>
                      {String(value)} {String(label)}
                    </Text>
                  </View>
                ))}
              </View>

              {Boolean(pendingTakeover.note) && (
                <Txt>{pendingTakeover.note}</Txt>
              )}

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
                    : "Accept caregiver takeover"
                }
                disabled={Boolean(busyId)}
                icon="checkmark-circle-outline"
                onPress={() => void acceptTakeover(false)}
              />
              <Button
                title="Accept & flag note as concern"
                secondary
                icon="flag-outline"
                disabled={Boolean(busyId) || !takeoverNote.trim()}
                onPress={() => void acceptTakeover(true)}
              />
            </View>
          </ShiftReveal>
        )}

        <ShiftReveal delay={125}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => n.navigate("CareTasks")}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 79,
                borderRadius: 24,
                paddingHorizontal: 14,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                backgroundColor: "#F4EEFA",
                opacity: pressed ? 0.72 : 1,
              })}
            >
              <View
                style={{
                  width: 39,
                  height: 39,
                  borderRadius: 14,
                  backgroundColor: "#FFFFFF",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="document-text-outline" size={21} color="#7B35A8" />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[S.h3, { fontSize: 13.5, color: "#6F2D9D" }]}>
                  Full care plan
                </Text>
                <Txt style={[S.small, { fontSize: 10.5 }]}>View today’s plan</Txt>
              </View>
              <Icon name="chevron-forward" size={18} color="#71309F" />
            </Pressable>

            {!readOnly && (
              <Pressable
                accessibilityRole="button"
                onPress={openHandoff}
                style={({ pressed }) => ({
                  flex: 1,
                  minHeight: 79,
                  borderRadius: 24,
                  paddingHorizontal: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  backgroundColor: "#7B35A8",
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <View
                  style={{
                    width: 39,
                    height: 39,
                    borderRadius: 14,
                    backgroundColor: "rgba(255,255,255,0.15)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name="swap-horizontal-outline" size={22} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[S.h3, { fontSize: 13.5, color: "#FFFFFF" }]}>
                    Create shift briefing
                  </Text>
                  <Text
                    style={{
                      fontFamily: "DMSans_400Regular",
                      fontSize: 10.5,
                      color: "#EADFF0",
                    }}
                  >
                    Generate handoff
                  </Text>
                </View>
                <Icon name="chevron-forward" size={18} color="#FFFFFF" />
              </Pressable>
            )}
          </View>
        </ShiftReveal>

        {handoffOpen && !readOnly && (
          <ShiftReveal>
            <View
              style={{
                borderRadius: 26,
                padding: 17,
                backgroundColor: "#FBF8FC",
                borderWidth: 1,
                borderColor: "#E9E0EE",
                gap: 13,
              }}
            >
              <View style={S.between}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[S.eyebrow, { color: "#7A35A6" }]}>
                    NEW SHIFT BRIEFING
                  </Text>
                  <Text style={[S.h2, { fontSize: 18 }]}>Prepare the handoff</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close shift briefing"
                  onPress={() => setHandoffOpen(false)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: "#F1EAF5",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name="close" size={19} color="#7A35A6" />
                </Pressable>
              </View>

              <Field
                label="Shift label"
                value={shiftLabel}
                onChange={(value) => setShiftLabel(value.slice(0, 120))}
              />
              <Field
                label="Brief note (optional)"
                value={handoffNote}
                onChange={(value) => setHandoffNote(value.slice(0, 4000))}
                multiline
              />

              <Text style={[S.h3, { fontSize: 13 }]}>Hand off to</Text>
              <MemberChoice
                title="Shared care team"
                subtitle="Any active Owner or Caregiver can review it."
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

              <View
                style={{
                  borderRadius: 20,
                  padding: 14,
                  backgroundColor: "#FFFFFF",
                  borderWidth: 1,
                  borderColor: "#EEE6F2",
                  gap: 7,
                }}
              >
                <Text style={[S.h3, { fontSize: 13 }]}>Briefing snapshot</Text>
                <Txt style={[S.small, { fontSize: 11.5 }]}>
                  {briefingCounts.openTasks} unfinished ·{" "}
                  {briefingCounts.completedTasks} completed ·{" "}
                  {briefingCounts.medications} medication ·{" "}
                  {briefingCounts.communications} communication
                </Txt>
                <Txt style={[S.small, { fontSize: 11.5 }]}>
                  {briefingCounts.coordination} coordination ·{" "}
                  {briefingCounts.followUps} follow-up
                </Txt>
              </View>

              <Button
                title={
                  busyId === "handoff"
                    ? "Saving briefing…"
                    : "Save and share shift briefing"
                }
                disabled={busyId === "handoff" || !shiftLabel.trim()}
                onPress={() => void saveHandoff()}
              />
            </View>
          </ShiftReveal>
        )}

        <View style={{ flexDirection: "row", gap: 9 }}>
          <ShiftTab
            label="Today"
            active={activeTab === "today"}
            onPress={() => setActiveTab("today")}
          />
          <ShiftTab
            label="Completed"
            active={activeTab === "completed"}
            onPress={() => setActiveTab("completed")}
          />
          <ShiftTab
            label="Handoffs"
            active={activeTab === "handoffs"}
            onPress={() => setActiveTab("handoffs")}
          />
        </View>

        {loading ? (
          <View
            style={{
              minHeight: 140,
              borderRadius: 25,
              backgroundColor: "#FFFFFF",
              borderWidth: 1,
              borderColor: "#ECE6F0",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            <ActivityIndicator color={C.purple} />
            <Txt style={S.small}>Loading today’s shift board…</Txt>
          </View>
        ) : activeTab === "today" ? (
          <View style={{ gap: 12 }}>
            {!openTasks.length ? (
              <ShiftReveal>
                <View
                  style={{
                    minHeight: 130,
                    borderRadius: 25,
                    padding: 17,
                    backgroundColor: "#FFFFFF",
                    borderWidth: 1,
                    borderColor: "#ECE6F0",
                    flexDirection: "row",
                    alignItems: "center",
                    overflow: "hidden",
                  }}
                >
                  <View style={{ flex: 1, gap: 6 }}>
                    <View
                      style={{
                        width: 43,
                        height: 43,
                        borderRadius: 22,
                        backgroundColor: "#F4ECFB",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon name="checkmark-done-outline" size={23} color="#7936A7" />
                    </View>
                    <Text style={[S.h3, { fontSize: 15.5 }]}>No open care tasks</Text>
                    <Txt style={[S.small, { fontSize: 11.5 }]}>
                      The shared care plan is clear right now.
                    </Txt>
                  </View>
                  <ShiftMiniGraphic kind="tasks" />
                </View>
              </ShiftReveal>
            ) : (
              <>
                {openTasks.slice(0, 4).map((task, index) => {
                  const bucket = shiftTaskBucket(task);
                  const busy = busyId === task.id;

                  return (
                    <ShiftReveal key={task.id} delay={Math.min(index * 45, 150)}>
                      <View
                        style={{
                          borderRadius: 24,
                          padding: 16,
                          backgroundColor:
                            bucket === "overdue" ? "#FFF6F6" : "#FFFFFF",
                          borderWidth: 1,
                          borderColor:
                            bucket === "overdue" ? "#F0D2D5" : "#ECE6F0",
                          gap: 10,
                        }}
                      >
                        <View style={S.between}>
                          <View style={{ flex: 1, gap: 5 }}>
                            <View
                              style={[
                                S.pill,
                                {
                                  alignSelf: "flex-start",
                                  backgroundColor: bucketBackground(bucket),
                                },
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
                            <Text style={[S.h2, { fontSize: 17 }]}>{task.title}</Text>
                          </View>
                          <Icon
                            name={task.priority === "high" ? "alert-circle-outline" : "checkbox-outline"}
                            size={24}
                            color={task.priority === "high" ? C.rose : C.purple}
                          />
                        </View>

                        {Boolean(task.details) && (
                          <Txt style={[S.small, { fontSize: 11.5 }]}>
                            {task.details}
                          </Txt>
                        )}

                        <Txt style={[S.small, { fontSize: 11.5 }]}>
                          Due {new Date(task.dueAt).toLocaleString()} ·{" "}
                          {memberName(task.assignedTo)}
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
                          <View style={{ gap: 8 }}>
                            <Text style={[S.h3, { fontSize: 13 }]}>Reassign to</Text>
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
                          </View>
                        )}
                      </View>
                    </ShiftReveal>
                  );
                })}
                {openTasks.length > 4 && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => n.navigate("CareTasks")}
                    style={({ pressed }) => ({
                      minHeight: 46,
                      borderRadius: 23,
                      backgroundColor: "#F3ECF8",
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: pressed ? 0.72 : 1,
                    })}
                  >
                    <Text style={[S.h3, { fontSize: 12.5, color: "#71309F" }]}>
                      View all {openTasks.length} open tasks
                    </Text>
                  </Pressable>
                )}
              </>
            )}

            {!handoffs.length ? (
              <ShiftReveal delay={50}>
                <View
                  style={{
                    minHeight: 126,
                    borderRadius: 25,
                    padding: 17,
                    backgroundColor: "#FFFFFF",
                    borderWidth: 1,
                    borderColor: "#ECE6F0",
                    flexDirection: "row",
                    alignItems: "center",
                    overflow: "hidden",
                  }}
                >
                  <View style={{ flex: 1, gap: 6 }}>
                    <View
                      style={{
                        width: 43,
                        height: 43,
                        borderRadius: 22,
                        backgroundColor: "#F4ECFB",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon name="swap-horizontal-outline" size={23} color="#7936A7" />
                    </View>
                    <Text style={[S.h3, { fontSize: 15.5 }]}>
                      No recent caregiver handoffs
                    </Text>
                    <Txt style={[S.small, { fontSize: 11.5 }]}>
                      New handoffs will appear here when available.
                    </Txt>
                  </View>
                  <ShiftMiniGraphic kind="handoffs" />
                </View>
              </ShiftReveal>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={() => setActiveTab("handoffs")}
                style={({ pressed }) => ({
                  minHeight: 104,
                  borderRadius: 24,
                  padding: 16,
                  backgroundColor: "#FFFFFF",
                  borderWidth: 1,
                  borderColor: "#ECE6F0",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 13,
                  opacity: pressed ? 0.76 : 1,
                })}
              >
                <View
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 23,
                    backgroundColor: "#F4ECFB",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name="swap-horizontal-outline" size={24} color="#7936A7" />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={[S.h3, { fontSize: 15 }]}>
                    Latest handoff · {handoffs[0].shiftLabel}
                  </Text>
                  <Txt style={[S.small, { fontSize: 11.5 }]}>
                    {new Date(handoffs[0].createdAt).toLocaleString()} ·{" "}
                    {handoffs[0].openTaskSnapshot.length} unfinished
                  </Txt>
                </View>
                <Icon name="chevron-forward" size={20} color="#7936A7" />
              </Pressable>
            )}

            <ShiftReveal delay={90}>
              <View
                style={{
                  minHeight: 128,
                  borderRadius: 25,
                  padding: 17,
                  backgroundColor: allClear ? "#EAF8EE" : "#FFF6E9",
                  borderWidth: 1,
                  borderColor: allClear ? "#D8EEDD" : "#F2E0C1",
                  flexDirection: "row",
                  alignItems: "center",
                  overflow: "hidden",
                }}
              >
                <View style={{ flex: 1, gap: 7 }}>
                  <View
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 23,
                      backgroundColor: allClear ? "#D7F2E0" : "#FFE8C8",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon
                      name={allClear ? "shield-checkmark-outline" : "warning-outline"}
                      size={25}
                      color={allClear ? "#17995A" : "#B66C1F"}
                    />
                  </View>
                  <Text style={[S.h3, { fontSize: 16 }]}>
                    {allClear ? "All clear right now" : "A few things need attention"}
                  </Text>
                  <Txt style={[S.small, { fontSize: 11.5 }]}>
                    {allClear
                      ? "No coordination alerts need your attention."
                      : `${counts.overdue} overdue · ${actualCoverage.missingCheckIn.length} missing check-in · ${actionableCoordination.length} coordination alert${actionableCoordination.length === 1 ? "" : "s"}.`}
                  </Txt>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setShowCoverageDetails((value) => !value)}
                    style={{ alignSelf: "flex-start", paddingVertical: 4 }}
                  >
                    <Text
                      style={{
                        fontFamily: "DMSans_600SemiBold",
                        fontSize: 11.5,
                        color: allClear ? "#16834F" : "#9A5C1C",
                      }}
                    >
                      {showCoverageDetails ? "Hide coverage details" : "View coverage details"}
                    </Text>
                  </Pressable>
                </View>
                <ShiftMiniGraphic kind="clear" />
              </View>
            </ShiftReveal>

            {showCoverageDetails && (
              <ShiftReveal>
                <View style={{ gap: 9 }}>
                  {coverage.rows.map(({ member, open, overdue, dueToday }) => (
                    <View
                      key={member.userId}
                      style={{
                        borderRadius: 20,
                        padding: 14,
                        backgroundColor: "#FFFFFF",
                        borderWidth: 1,
                        borderColor: "#ECE6F0",
                        gap: 5,
                      }}
                    >
                      <View style={S.between}>
                        <View style={{ flex: 1 }}>
                          <Text style={[S.h3, { fontSize: 13.5 }]}>
                            {member.isCurrentUser
                              ? `${member.displayName || "Me"} · You`
                              : member.displayName || "Caregiver"}
                          </Text>
                          <Txt style={[S.small, { fontSize: 10.5 }]}>
                            {member.role === "owner" ? "Care owner" : "Caregiver"}
                          </Txt>
                        </View>
                        <View
                          style={[
                            S.pill,
                            { backgroundColor: overdue ? C.redBg : C.lavender },
                          ]}
                        >
                          <Text style={[S.small, { color: overdue ? C.rose : C.deep }]}>
                            {open} open
                          </Text>
                        </View>
                      </View>
                      <Txt style={[S.small, { fontSize: 10.5 }]}>
                        {dueToday} due today{overdue ? ` · ${overdue} overdue` : ""}
                      </Txt>
                    </View>
                  ))}

                  {coverage.unassigned.open > 0 && (
                    <View
                      style={{
                        borderRadius: 20,
                        padding: 14,
                        backgroundColor: "#FFF8ED",
                        borderWidth: 1,
                        borderColor: "#F2E4CB",
                      }}
                    >
                      <Text style={[S.h3, { fontSize: 13.5 }]}>
                        Shared / unassigned responsibility
                      </Text>
                      <Txt style={[S.small, { fontSize: 10.5 }]}>
                        {coverage.unassigned.open} open
                        {coverage.unassigned.overdue
                          ? ` · ${coverage.unassigned.overdue} overdue`
                          : ""}
                      </Txt>
                    </View>
                  )}
                </View>
              </ShiftReveal>
            )}
          </View>
        ) : activeTab === "completed" ? (
          <View style={{ gap: 11 }}>
            {todaysCompletions.length ? (
              todaysCompletions.slice(0, 20).map((completion, index) => (
                <ShiftReveal key={completion.id} delay={Math.min(index * 35, 200)}>
                  <View
                    style={{
                      minHeight: 86,
                      borderRadius: 22,
                      padding: 15,
                      backgroundColor: "#FFFFFF",
                      borderWidth: 1,
                      borderColor: "#ECE6F0",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: "#E5F8EB",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon name="checkmark" size={22} color="#1B9B59" />
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={[S.h3, { fontSize: 14.5 }]}>
                        {taskMap.get(completion.taskId)?.title || "Care task"}
                      </Text>
                      <Txt style={[S.small, { fontSize: 10.8 }]}>
                        {new Date(completion.completedAt).toLocaleString()} ·{" "}
                        {memberName(completion.completedBy)}
                      </Txt>
                      {Boolean(completion.note) && (
                        <Txt style={[S.small, { fontSize: 10.8 }]}>
                          {completion.note}
                        </Txt>
                      )}
                    </View>
                  </View>
                </ShiftReveal>
              ))
            ) : (
              <View
                style={{
                  minHeight: 150,
                  borderRadius: 25,
                  backgroundColor: "#FFFFFF",
                  borderWidth: 1,
                  borderColor: "#ECE6F0",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 9,
                  padding: 20,
                }}
              >
                <View
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 27,
                    backgroundColor: "#F3ECF8",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name="checkmark-done-outline" size={27} color="#7C39AA" />
                </View>
                <Text style={[S.h3, { fontSize: 15.5 }]}>Nothing completed yet</Text>
                <Txt style={[S.small, { textAlign: "center", fontSize: 11.5 }]}>
                  Completed care tasks will appear here throughout the day.
                </Txt>
              </View>
            )}
          </View>
        ) : (
          <View style={{ gap: 11 }}>
            {handoffs.length ? (
              handoffs.slice(0, 12).map((handoff, index) => {
                const acknowledgement = acknowledgementMap.get(handoff.id);
                const expanded = expandedHandoffId === handoff.id;

                return (
                  <ShiftReveal key={handoff.id} delay={Math.min(index * 35, 200)}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded }}
                      onPress={() =>
                        setExpandedHandoffId(expanded ? null : handoff.id)
                      }
                      style={({ pressed }) => ({
                        borderRadius: 24,
                        padding: 16,
                        backgroundColor: "#FFFFFF",
                        borderWidth: 1,
                        borderColor: "#ECE6F0",
                        gap: 10,
                        opacity: pressed ? 0.82 : 1,
                      })}
                    >
                      <View style={S.between}>
                        <View style={{ flex: 1, gap: 4 }}>
                          <Text style={[S.h3, { fontSize: 15 }]}>
                            {handoff.shiftLabel}
                          </Text>
                          <Txt style={[S.small, { fontSize: 10.8 }]}>
                            {new Date(handoff.createdAt).toLocaleString()} · From{" "}
                            {memberName(handoff.createdBy)}
                            {handoff.handoffTo
                              ? ` · To ${memberName(handoff.handoffTo)}`
                              : ""}
                          </Txt>
                        </View>
                        <View
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 19,
                            backgroundColor: "#F3ECF8",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Icon
                            name={expanded ? "chevron-up" : "chevron-down"}
                            size={18}
                            color="#7A35A6"
                          />
                        </View>
                      </View>

                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                        <View style={[S.pill, { backgroundColor: "#F4EEFA" }]}>
                          <Text style={S.small}>
                            {handoff.openTaskSnapshot.length} unfinished
                          </Text>
                        </View>
                        <View style={[S.pill, { backgroundColor: "#F4EEFA" }]}>
                          <Text style={S.small}>
                            {handoff.completedTaskSnapshot.length} completed
                          </Text>
                        </View>
                        {handoff.requiresAcknowledgement && (
                          <View
                            style={[
                              S.pill,
                              {
                                backgroundColor: acknowledgement
                                  ? "#E6F6EC"
                                  : "#FFF0D9",
                              },
                            ]}
                          >
                            <Text style={S.small}>
                              {acknowledgement ? "Takeover accepted" : "Awaiting takeover"}
                            </Text>
                          </View>
                        )}
                      </View>

                      {expanded && (
                        <View style={{ gap: 8, paddingTop: 2 }}>
                          {Boolean(handoff.note) && <Txt>{handoff.note}</Txt>}
                          {handoff.nextAppointmentSnapshot && (
                            <Txt style={S.small}>
                              Next visit: {handoff.nextAppointmentSnapshot.title} ·{" "}
                              {new Date(
                                handoff.nextAppointmentSnapshot.startsAt,
                              ).toLocaleString()}
                            </Txt>
                          )}
                          {handoff.openTaskSnapshot.slice(0, 3).map((item, itemIndex) => (
                            <Txt key={String(item.id ?? itemIndex)} style={S.small}>
                              • {String(item.title ?? "Care task")} ·{" "}
                              {String(item.assigneeName ?? "Shared care team")}
                            </Txt>
                          ))}
                          {handoff.communicationSnapshot.slice(0, 2).map((item) => (
                            <Txt key={item.id} style={S.small}>
                              • Communication: {item.summary}
                            </Txt>
                          ))}
                          {handoff.coordinationSnapshot.slice(0, 2).map((item) => (
                            <Txt key={item.id} style={S.small}>
                              • Coordination: {item.title}
                            </Txt>
                          ))}
                        </View>
                      )}
                    </Pressable>
                  </ShiftReveal>
                );
              })
            ) : (
              <View
                style={{
                  minHeight: 156,
                  borderRadius: 25,
                  padding: 20,
                  backgroundColor: "#FFFFFF",
                  borderWidth: 1,
                  borderColor: "#ECE6F0",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 9,
                }}
              >
                <ShiftMiniGraphic kind="handoffs" />
                <Text style={[S.h3, { fontSize: 15.5 }]}>
                  No caregiver handoffs yet
                </Text>
                <Txt style={[S.small, { textAlign: "center", fontSize: 11.5 }]}>
                  New shift briefings will appear here once they are created.
                </Txt>
              </View>
            )}
          </View>
        )}

        <View
          style={{
            borderRadius: 24,
            padding: 15,
            backgroundColor: "#F8F5FA",
            borderWidth: 1,
            borderColor: "#EEE8F1",
            gap: 10,
          }}
        >
          <Text
            style={{
              fontFamily: "DMSans_700Bold",
              fontSize: 13.5,
              color: "#292442",
            }}
          >
            More shift tools
          </Text>
          <View style={{ flexDirection: "row", gap: 9 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => n.navigate("CareSchedule")}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 54,
                borderRadius: 18,
                paddingHorizontal: 12,
                backgroundColor: "#FFFFFF",
                borderWidth: 1,
                borderColor: "#EEE7F1",
                flexDirection: "row",
                alignItems: "center",
                gap: 9,
                opacity: pressed ? 0.72 : 1,
              })}
            >
              <Icon name="calendar-outline" size={19} color="#7936A7" />
              <Text style={[S.h3, { fontSize: 11.5, flex: 1 }]}>Schedule</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => n.navigate("CareAnalytics")}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 54,
                borderRadius: 18,
                paddingHorizontal: 12,
                backgroundColor: "#FFFFFF",
                borderWidth: 1,
                borderColor: "#EEE7F1",
                flexDirection: "row",
                alignItems: "center",
                gap: 9,
                opacity: pressed ? 0.72 : 1,
              })}
            >
              <Icon name="bar-chart-outline" size={19} color="#7936A7" />
              <Text style={[S.h3, { fontSize: 11.5, flex: 1 }]}>Analytics</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Page>
  );
}
