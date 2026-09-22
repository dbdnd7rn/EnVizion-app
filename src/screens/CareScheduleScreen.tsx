import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import {
  availabilityStatusLabels,
  availabilityStatuses,
  cancelCareShift,
  createCareShift,
  createCaregiverAvailability,
  deleteCaregiverAvailability,
  loadCareSchedule,
  requestCareShiftSwap,
  respondToCareShiftSwap,
  type AvailabilityStatus,
  type CareShift,
  type CareShiftSwapRequest,
  type CaregiverAvailability,
} from "../careSchedule";
import {
  shiftAvailabilityFit,
  uncoveredUpcomingTasks,
  upcomingScheduledShifts,
} from "../careScheduleHelpers";
import {
  currentCareTaskUserId,
  loadCareTasks,
  type CareTask,
} from "../careTasks";
import {
  loadCareTeam,
  type CareTeamMember,
  type CareTeamRoster,
} from "../careTeam";
import {
  detectedTimezone,
  localDateTimeToIso,
  reminderLocalParts,
} from "../reminders";
import { supabase } from "../supabase";
import {
  endShiftAttendance,
  loadShiftAttendance,
  startShiftAttendance,
  type CareShiftAttendance,
} from "../shiftAttendance";
import {
  actualCoverageNow,
  attendanceDurationMinutes,
  attendanceForShift,
  shiftAttendanceState,
} from "../shiftAttendanceHelpers";
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

type WindowDraft = {
  caregiverId: string | null;
  status: AvailabilityStatus;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  note: string;
};

type ShiftDraft = {
  caregiverId: string | null;
  label: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  note: string;
};

function defaultWindow() {
  const start = new Date(Date.now() + 60 * 60_000);
  const end = new Date(start.getTime() + 4 * 60 * 60_000);
  const a = reminderLocalParts(start.toISOString());
  const b = reminderLocalParts(end.toISOString());
  return {
    startDate: a.date,
    startTime: a.time,
    endDate: b.date,
    endTime: b.time,
  };
}

function blankWindow(caregiverId: string | null): WindowDraft {
  const value = defaultWindow();
  return {
    caregiverId,
    status: "available",
    ...value,
    note: "",
  };
}

function blankShift(caregiverId: string | null): ShiftDraft {
  const value = defaultWindow();
  return {
    caregiverId,
    label: "Caregiver shift",
    ...value,
    note: "",
  };
}

function Choice({
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

function fitCopy(fit: ReturnType<typeof shiftAvailabilityFit>) {
  if (fit === "conflict") return "Conflicts with Unavailable time";
  if (fit === "preferred") return "Inside preferred availability";
  if (fit === "covered") return "Inside available time";
  return "Availability not specified";
}

function fitBackground(fit: ReturnType<typeof shiftAvailabilityFit>) {
  if (fit === "conflict") return C.redBg;
  if (fit === "preferred") return "#EAF4EF";
  if (fit === "covered") return C.lavender;
  return "#F0ECEF";
}

function attendanceCopy(state: ReturnType<typeof shiftAttendanceState>) {
  if (state === "ready") return "Ready to check in";
  if (state === "late_no_checkin") return "No check-in";
  if (state === "active") return "Checked in";
  if (state === "active_late") return "Checked in late";
  if (state === "completed") return "Completed";
  return "Upcoming";
}

function attendanceBackground(state: ReturnType<typeof shiftAttendanceState>) {
  if (state === "late_no_checkin") return C.redBg;
  if (state === "active" || state === "completed") return "#EAF4EF";
  if (state === "active_late") return "#FFF1E5";
  if (state === "ready") return C.lavender;
  return "#F0ECEF";
}

export function CareScheduleScreen() {
  const n = useNav();
  const { state } = useCare();
  const careRecipientId = state.careRecipientId;
  const readOnly = state.accessRole === "viewer";
  const owner = state.accessRole === "owner";

  const [availability, setAvailability] = useState<CaregiverAvailability[]>([]);
  const [shifts, setShifts] = useState<CareShift[]>([]);
  const [swaps, setSwaps] = useState<CareShiftSwapRequest[]>([]);
  const [tasks, setTasks] = useState<CareTask[]>([]);
  const [attendance, setAttendance] = useState<CareShiftAttendance[]>([]);
  const [roster, setRoster] = useState<CareTeamRoster | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const [availabilityFormOpen, setAvailabilityFormOpen] = useState(false);
  const [shiftFormOpen, setShiftFormOpen] = useState(false);
  const [availabilityDraft, setAvailabilityDraft] =
    useState<WindowDraft>(blankWindow(null));
  const [shiftDraft, setShiftDraft] = useState<ShiftDraft>(blankShift(null));

  const [swapShift, setSwapShift] = useState<CareShift | null>(null);
  const [swapTo, setSwapTo] = useState<string | null>(null);
  const [swapMessage, setSwapMessage] = useState("");
  const [checkoutAttendance, setCheckoutAttendance] =
    useState<CareShiftAttendance | null>(null);
  const [checkoutNote, setCheckoutNote] = useState("");

  const refresh = useCallback(async () => {
    if (!careRecipientId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const userId = await currentCareTaskUserId();
      const [schedule, team, taskRows, attendanceRows] = await Promise.all([
        loadCareSchedule(careRecipientId),
        loadCareTeam(careRecipientId),
        loadCareTasks(careRecipientId),
        loadShiftAttendance(careRecipientId),
      ]);

      setCurrentUserId(userId);
      setAvailability(schedule.availability);
      setShifts(schedule.shifts);
      setSwaps(schedule.swaps);
      setAttendance(attendanceRows);
      setRoster(team);

      const defaultCaregiver =
        state.accessRole === "owner"
          ? team.members.find(
              (member) =>
                member.status === "active" &&
                (member.role === "owner" || member.role === "caregiver"),
            )?.userId ?? userId
          : userId;

      setAvailabilityDraft((draft) =>
        draft.caregiverId
          ? draft
          : { ...draft, caregiverId: defaultCaregiver },
      );
      setShiftDraft((draft) =>
        draft.caregiverId
          ? draft
          : { ...draft, caregiverId: defaultCaregiver },
      );
      setTasks(taskRows);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not load the caregiver schedule.",
      );
    } finally {
      setLoading(false);
    }
  }, [careRecipientId, state.accessRole]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!careRecipientId) return;

    const channel = supabase
      .channel(`care-schedule:${careRecipientId}`)
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
          table: "care_shift_swap_requests",
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
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [careRecipientId, refresh]);

  const members = useMemo(() => {
    const active =
      roster?.members.filter(
        (member) =>
          member.status === "active" &&
          (member.role === "owner" || member.role === "caregiver"),
      ) ?? [];

    if (
      currentUserId &&
      state.accessRole !== "viewer" &&
      !active.some((member) => member.userId === currentUserId)
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
        ...active,
      ];
    }

    return active;
  }, [currentUserId, roster, state.accessRole, state.name]);

  const memberMap = useMemo(
    () => new Map((roster?.members ?? members).map((item) => [item.userId, item])),
    [members, roster],
  );

  const shiftMap = useMemo(
    () => new Map(shifts.map((shift) => [shift.id, shift])),
    [shifts],
  );

  const upcomingShifts = useMemo(
    () => upcomingScheduledShifts(shifts),
    [shifts],
  );

  const actualCoverage = useMemo(
    () => actualCoverageNow(shifts, attendance),
    [attendance, shifts],
  );

  const coverageGaps = useMemo(
    () => uncoveredUpcomingTasks(tasks, shifts),
    [shifts, tasks],
  );

  const futureAvailability = useMemo(
    () =>
      availability
        .filter((item) => new Date(item.endsAt).getTime() >= Date.now())
        .sort(
          (a, b) =>
            new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
        ),
    [availability],
  );

  function memberName(userId: string | null) {
    if (!userId) return "Caregiver";
    const member = memberMap.get(userId);
    if (!member) return "Caregiver";
    return member.isCurrentUser
      ? `${member.displayName || "Me"} (me)`
      : member.displayName || "Caregiver";
  }

  function editableCaregivers() {
    if (owner) return members;
    return members.filter((member) => member.userId === currentUserId);
  }

  function parseWindow(
    startDate: string,
    startTime: string,
    endDate: string,
    endTime: string,
  ) {
    const timezone = detectedTimezone();
    const startsAt = localDateTimeToIso(startDate, startTime);
    const endsAt = localDateTimeToIso(endDate, endTime);
    if (!startsAt || !endsAt) {
      throw new Error("Use valid dates and 24-hour times such as 2026-09-22 and 08:30.");
    }
    if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      throw new Error("The end time must be after the start time.");
    }
    return { startsAt, endsAt, timezone };
  }

  async function saveAvailability() {
    if (!careRecipientId || readOnly || !availabilityDraft.caregiverId) return;

    setBusy("availability");
    setMessage("");
    try {
      const parsed = parseWindow(
        availabilityDraft.startDate,
        availabilityDraft.startTime,
        availabilityDraft.endDate,
        availabilityDraft.endTime,
      );
      await createCaregiverAvailability({
        careRecipientId,
        caregiverId: availabilityDraft.caregiverId,
        startsAt: parsed.startsAt,
        endsAt: parsed.endsAt,
        status: availabilityDraft.status,
        note: availabilityDraft.note,
      });
      setAvailabilityFormOpen(false);
      setAvailabilityDraft(blankWindow(currentUserId));
      await refresh();
      setMessage("Availability saved.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "We could not save availability.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function saveShift() {
    if (!careRecipientId || readOnly || !shiftDraft.caregiverId) return;

    setBusy("shift");
    setMessage("");
    try {
      const parsed = parseWindow(
        shiftDraft.startDate,
        shiftDraft.startTime,
        shiftDraft.endDate,
        shiftDraft.endTime,
      );
      await createCareShift({
        careRecipientId,
        caregiverId: shiftDraft.caregiverId,
        label: shiftDraft.label,
        startsAt: parsed.startsAt,
        endsAt: parsed.endsAt,
        note: shiftDraft.note,
      });
      setShiftFormOpen(false);
      setShiftDraft(blankShift(currentUserId));
      await refresh();
      setMessage("Caregiver shift scheduled.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "We could not schedule the shift.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function removeAvailability(item: CaregiverAvailability) {
    if (!careRecipientId || readOnly || busy) return;
    setBusy(item.id);
    setMessage("");
    try {
      await deleteCaregiverAvailability(careRecipientId, item.id);
      await refresh();
      setMessage("Availability window removed.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "We could not remove that window.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function cancelShift(shift: CareShift) {
    if (!careRecipientId || readOnly || busy) return;
    setBusy(shift.id);
    setMessage("");
    try {
      await cancelCareShift(careRecipientId, shift.id);
      await refresh();
      setMessage("Shift cancelled.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "We could not cancel that shift.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function startShift(shift: CareShift) {
    if (!careRecipientId || busy || shift.caregiverId !== currentUserId) return;
    setBusy(`checkin:${shift.id}`);
    setMessage("");
    try {
      const row = await startShiftAttendance({
        careRecipientId,
        shiftId: shift.id,
        note: "",
      });
      await refresh();
      setMessage(
        row.lateMinutes > 0
          ? `Checked in · ${row.lateMinutes} minute${row.lateMinutes === 1 ? "" : "s"} after scheduled start.`
          : "Checked in. Your shift is now active.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "We could not start this shift.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function endShift() {
    if (!careRecipientId || !checkoutAttendance || busy) return;
    setBusy(`checkout:${checkoutAttendance.id}`);
    setMessage("");
    try {
      await endShiftAttendance({
        careRecipientId,
        attendanceId: checkoutAttendance.id,
        note: checkoutNote,
      });
      setCheckoutAttendance(null);
      setCheckoutNote("");
      await refresh();
      setMessage(
        "Shift ended. EnVizion created the next caregiver handoff automatically.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "We could not end this shift.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function submitSwap() {
    if (!careRecipientId || !swapShift || !swapTo || busy) return;
    setBusy("swap");
    setMessage("");
    try {
      await requestCareShiftSwap({
        careRecipientId,
        shiftId: swapShift.id,
        requestedTo: swapTo,
        message: swapMessage,
      });
      setSwapShift(null);
      setSwapTo(null);
      setSwapMessage("");
      await refresh();
      setMessage("Shift swap request sent.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not send that swap request.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function respond(
    swap: CareShiftSwapRequest,
    status: "accepted" | "declined" | "cancelled",
  ) {
    if (!careRecipientId || busy) return;
    setBusy(swap.id);
    setMessage("");
    try {
      await respondToCareShiftSwap(careRecipientId, swap.id, status, "");
      await refresh();
      setMessage(
        status === "accepted"
          ? "Shift swap accepted and the schedule was updated."
          : status === "declined"
            ? "Shift swap declined."
            : "Shift swap request cancelled.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not update that swap request.",
      );
    } finally {
      setBusy(null);
    }
  }

  if (!careRecipientId) {
    return (
      <Page>
        <Heading
          eyebrow="CAREGIVER SCHEDULE"
          title="Choose a care profile first."
        />
      </Page>
    );
  }

  return (
    <Page>
      <Heading
        eyebrow="AVAILABILITY & SHIFT SCHEDULING"
        title="Plan who is available before care work becomes urgent."
        body="Coordinate caregiver availability, scheduled shifts, real check-ins, attendance history, coverage gaps, and shift swaps for this care profile."
      />

      <Card style={{ backgroundColor: C.deep, borderWidth: 0 }}>
        <Text style={[S.eyebrow, { color: "#E7CFEF" }]}>ACTUAL COVERAGE NOW</Text>
        <Text style={[S.h2, { color: C.white }]}>
          {actualCoverage.scheduledNow.length
            ? `${actualCoverage.checkedInNow.length}/${actualCoverage.scheduledNow.length} scheduled caregiver${actualCoverage.scheduledNow.length === 1 ? "" : "s"} checked in`
            : "No caregiver shift is scheduled right now"}
        </Text>
        <Txt style={{ color: "#E9DDED" }}>
          {actualCoverage.missingCheckIn.length
            ? `${actualCoverage.missingCheckIn.length} active shift${actualCoverage.missingCheckIn.length === 1 ? "" : "s"} still need check-in confirmation.`
            : `${coverageGaps.length} upcoming task${coverageGaps.length === 1 ? "" : "s"} without matching scheduled coverage.`}
        </Txt>
      </Card>

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
            You can see availability, shifts, check-in status, attendance,
            coverage gaps, and swap status, but cannot change the schedule.
          </Txt>
        </Card>
      )}

      <Button
        title="Back to today’s shift board"
        secondary
        icon="arrow-back-outline"
        onPress={() => n.navigate("CareShiftBoard")}
      />

      <Section title="Coverage gaps · next 7 days" />
      {!coverageGaps.length ? (
        <Card style={{ backgroundColor: "#EAF4EF" }}>
          <Icon name="shield-checkmark-outline" />
          <Text style={S.h3}>Every upcoming task has scheduled coverage.</Text>
          <Txt style={S.small}>
            Coverage is checked against the caregiver assigned to each task. An
            unassigned task can be covered by any scheduled caregiver.
          </Txt>
        </Card>
      ) : (
        coverageGaps.slice(0, 12).map((task) => (
          <Card key={task.id} style={{ borderColor: "#E8BDC3" }}>
            <View style={S.row}>
              <Icon name="warning-outline" color={C.rose} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={S.h3}>{task.title}</Text>
                <Txt style={S.small}>
                  Due {new Date(task.dueAt).toLocaleString()} ·{" "}
                  {task.assignedTo
                    ? `Assigned to ${memberName(task.assignedTo)}`
                    : "Shared responsibility"}
                </Txt>
                <Txt>
                  No matching scheduled shift covers this due time.
                </Txt>
              </View>
            </View>
          </Card>
        ))
      )}

      <Section title="Upcoming shifts · next 7 days" />
      {!readOnly && (
        <Button
          title={shiftFormOpen ? "Close shift form" : "Schedule a shift"}
          secondary
          icon="calendar-outline"
          onPress={() => setShiftFormOpen((value) => !value)}
        />
      )}

      {shiftFormOpen && !readOnly && (
        <Card>
          <Text style={S.h3}>Caregiver</Text>
          {editableCaregivers().map((member) => (
            <Choice
              key={member.userId}
              title={memberName(member.userId)}
              subtitle={member.role === "owner" ? "Care owner" : "Caregiver"}
              selected={shiftDraft.caregiverId === member.userId}
              disabled={busy === "shift"}
              onPress={() =>
                setShiftDraft((draft) => ({
                  ...draft,
                  caregiverId: member.userId,
                }))
              }
            />
          ))}

          <Field
            label="Shift label"
            value={shiftDraft.label}
            onChange={(value) =>
              setShiftDraft((draft) => ({ ...draft, label: value }))
            }
          />
          <Field
            label="Start date (YYYY-MM-DD)"
            value={shiftDraft.startDate}
            onChange={(value) =>
              setShiftDraft((draft) => ({ ...draft, startDate: value }))
            }
          />
          <Field
            label="Start time (HH:MM)"
            value={shiftDraft.startTime}
            onChange={(value) =>
              setShiftDraft((draft) => ({ ...draft, startTime: value }))
            }
          />
          <Field
            label="End date (YYYY-MM-DD)"
            value={shiftDraft.endDate}
            onChange={(value) =>
              setShiftDraft((draft) => ({ ...draft, endDate: value }))
            }
          />
          <Field
            label="End time (HH:MM)"
            value={shiftDraft.endTime}
            onChange={(value) =>
              setShiftDraft((draft) => ({ ...draft, endTime: value }))
            }
          />
          <Field
            label="Shift notes"
            value={shiftDraft.note}
            onChange={(value) =>
              setShiftDraft((draft) => ({ ...draft, note: value.slice(0, 2000) }))
            }
            multiline
          />
          <Button
            title={busy === "shift" ? "Scheduling…" : "Schedule shift"}
            disabled={busy === "shift" || !shiftDraft.caregiverId}
            onPress={() => void saveShift()}
          />
        </Card>
      )}

      {loading ? (
        <Card>
          <ActivityIndicator color={C.purple} />
          <Txt>Loading caregiver schedule…</Txt>
        </Card>
      ) : upcomingShifts.length ? (
        upcomingShifts.map((shift) => {
          const fit = shiftAvailabilityFit(shift, availability);
          const attendanceItem = attendanceForShift(shift.id, attendance);
          const attendanceState = shiftAttendanceState(
            shift,
            attendanceItem,
          );
          const canManage =
            !readOnly && (owner || shift.caregiverId === currentUserId);
          const canSwap =
            !attendanceItem &&
            shift.caregiverId === currentUserId &&
            members.some((member) => member.userId !== currentUserId);
          const canStart =
            !attendanceItem &&
            shift.caregiverId === currentUserId &&
            (attendanceState === "ready" ||
              attendanceState === "late_no_checkin");
          const canEnd =
            attendanceItem?.status === "active" &&
            attendanceItem.caregiverId === currentUserId;

          return (
            <Card key={shift.id}>
              <View style={S.between}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={S.h2}>{shift.label}</Text>
                  <Txt>
                    {memberName(shift.caregiverId)}
                  </Txt>
                </View>
                <View
                  style={[S.pill, { backgroundColor: fitBackground(fit) }]}
                >
                  <Text
                    style={[
                      S.small,
                      {
                        color: fit === "conflict" ? C.rose : C.deep,
                        fontFamily: "DMSans_600SemiBold",
                      },
                    ]}
                  >
                    {fitCopy(fit)}
                  </Text>
                </View>
              </View>

              <Txt style={S.small}>
                {new Date(shift.startsAt).toLocaleString()} →{" "}
                {new Date(shift.endsAt).toLocaleString()}
              </Txt>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <View
                  style={[
                    S.pill,
                    { backgroundColor: attendanceBackground(attendanceState) },
                  ]}
                >
                  <Text
                    style={[
                      S.small,
                      {
                        color:
                          attendanceState === "late_no_checkin"
                            ? C.rose
                            : C.deep,
                        fontFamily: "DMSans_600SemiBold",
                      },
                    ]}
                  >
                    {attendanceCopy(attendanceState)}
                  </Text>
                </View>
                {attendanceItem?.lateMinutes ? (
                  <View style={[S.pill, { backgroundColor: "#FFF1E5" }]}>
                    <Text style={[S.small, { color: C.deep }]}>
                      {attendanceItem.lateMinutes} min late
                    </Text>
                  </View>
                ) : null}
              </View>

              {attendanceItem && (
                <Txt style={S.small}>
                  Checked in {new Date(attendanceItem.checkedInAt).toLocaleString()}
                  {attendanceItem.checkedOutAt
                    ? ` · Ended ${new Date(attendanceItem.checkedOutAt).toLocaleString()}`
                    : ` · ${attendanceDurationMinutes(attendanceItem)} min active`}
                </Txt>
              )}

              {Boolean(shift.note) && <Txt>{shift.note}</Txt>

              {fit === "conflict" && (
                <Txt style={{ color: C.rose }}>
                  This shift overlaps a caregiver Unavailable window. Resolve
                  the conflict before relying on this coverage.
                </Txt>
              )}

              {attendanceState === "late_no_checkin" && (
                <Txt style={{ color: C.rose }}>
                  No “I’m here” confirmation has been recorded more than 15
                  minutes after the scheduled start.
                </Txt>
              )}

              {canStart && (
                <Button
                  title={
                    busy === `checkin:${shift.id}`
                      ? "Checking in…"
                      : "I’m here · Start shift"
                  }
                  icon="checkmark-circle-outline"
                  disabled={Boolean(busy)}
                  onPress={() => void startShift(shift)}
                />
              )}

              {canEnd && attendanceItem && (
                <Button
                  title="End shift"
                  secondary
                  icon="log-out-outline"
                  disabled={Boolean(busy)}
                  onPress={() => {
                    setCheckoutAttendance(attendanceItem);
                    setCheckoutNote("");
                  }}
                />
              )}

              {checkoutAttendance?.shiftId === shift.id && canEnd && (
                <Card style={{ backgroundColor: C.lavender }}>
                  <Text style={S.h3}>End shift & hand off care</Text>
                  <Txt style={S.small}>
                    Your clock-out time is stamped by EnVizion. This note is
                    carried into the automatic caregiver handoff.
                  </Txt>
                  <Field
                    label="Clock-out / handoff note"
                    value={checkoutNote}
                    onChange={(value) => setCheckoutNote(value.slice(0, 2000))}
                    multiline
                  />
                  <Button
                    title={
                      busy === `checkout:${attendanceItem.id}`
                        ? "Ending shift…"
                        : "Confirm end shift"
                    }
                    disabled={Boolean(busy)}
                    onPress={() => void endShift()}
                  />
                  <Button
                    title="Keep shift active"
                    secondary
                    disabled={Boolean(busy)}
                    onPress={() => setCheckoutAttendance(null)}
                  />
                </Card>
              )}

              {canManage && !attendanceItem && (
                <View style={{ flexDirection: "row", gap: 9 }}>
                  {canSwap && (
                    <View style={{ flex: 1 }}>
                      <Button
                        title="Request swap"
                        secondary
                        icon="swap-horizontal-outline"
                        disabled={Boolean(busy)}
                        onPress={() => {
                          setSwapShift(shift);
                          setSwapTo(null);
                          setSwapMessage("");
                        }}
                      />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Button
                      title={busy === shift.id ? "Cancelling…" : "Cancel shift"}
                      secondary
                      icon="close-circle-outline"
                      disabled={Boolean(busy)}
                      onPress={() => void cancelShift(shift)}
                    />
                  </View>
                </View>
              )}

              {swapShift?.id === shift.id && canSwap && (
                <Card style={{ backgroundColor: C.lavender }}>
                  <Text style={S.h3}>Ask another caregiver to take this shift</Text>
                  {members
                    .filter((member) => member.userId !== currentUserId)
                    .map((member) => (
                      <Choice
                        key={member.userId}
                        title={memberName(member.userId)}
                        subtitle={
                          member.role === "owner" ? "Care owner" : "Caregiver"
                        }
                        selected={swapTo === member.userId}
                        disabled={busy === "swap"}
                        onPress={() => setSwapTo(member.userId)}
                      />
                    ))}
                  <Field
                    label="Message"
                    value={swapMessage}
                    onChange={(value) => setSwapMessage(value.slice(0, 1200))}
                    multiline
                  />
                  <Button
                    title={busy === "swap" ? "Sending…" : "Send swap request"}
                    disabled={busy === "swap" || !swapTo}
                    onPress={() => void submitSwap()}
                  />
                  <Button
                    title="Cancel"
                    secondary
                    disabled={busy === "swap"}
                    onPress={() => setSwapShift(null)}
                  />
                </Card>
              )}
            </Card>
          );
        })
      ) : (
        <Card>
          <Icon name="calendar-outline" size={28} />
          <Text style={S.h3}>No scheduled shifts in the next 7 days.</Text>
          <Txt>
            Add a shift so EnVizion can compare upcoming task due times with
            actual caregiver coverage.
          </Txt>
        </Card>
      )}

      <Section title="Recent shift attendance" />
      {attendance.length ? (
        attendance.slice(0, 20).map((item) => {
          const shift = shiftMap.get(item.shiftId);
          return (
            <Card key={item.id}>
              <View style={S.between}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={S.h3}>{shift?.label || "Caregiver shift"}</Text>
                  <Txt>{memberName(item.caregiverId)}</Txt>
                </View>
                <View
                  style={[
                    S.pill,
                    {
                      backgroundColor:
                        item.status === "active" ? "#EAF4EF" : C.lavender,
                    },
                  ]}
                >
                  <Text style={[S.small, { color: C.deep }]}>
                    {item.status === "active" ? "Checked in" : "Completed"}
                  </Text>
                </View>
              </View>
              <Txt style={S.small}>
                Check-in {new Date(item.checkedInAt).toLocaleString()}
                {item.checkedOutAt
                  ? ` · Check-out ${new Date(item.checkedOutAt).toLocaleString()}`
                  : ""}
              </Txt>
              <Txt style={S.small}>
                Actual attendance: {attendanceDurationMinutes(item)} min
                {item.lateMinutes
                  ? ` · ${item.lateMinutes} min late`
                  : " · On time"}
              </Txt>
              {Boolean(item.checkOutNote) && <Txt>{item.checkOutNote}</Txt>}
              {item.automaticHandoffId && (
                <Txt style={S.small}>Automatic caregiver handoff created.</Txt>
              )}
            </Card>
          );
        })
      ) : (
        <Card>
          <Txt>No caregiver check-ins have been recorded yet.</Txt>
        </Card>
      )}

      <Section title="Availability" />
      {!readOnly && (
        <Button
          title={
            availabilityFormOpen
              ? "Close availability form"
              : "Add availability"
          }
          secondary
          icon="time-outline"
          onPress={() => setAvailabilityFormOpen((value) => !value)}
        />
      )}

      {availabilityFormOpen && !readOnly && (
        <Card>
          <Text style={S.h3}>Caregiver</Text>
          {editableCaregivers().map((member) => (
            <Choice
              key={member.userId}
              title={memberName(member.userId)}
              subtitle={member.role === "owner" ? "Care owner" : "Caregiver"}
              selected={availabilityDraft.caregiverId === member.userId}
              disabled={busy === "availability"}
              onPress={() =>
                setAvailabilityDraft((draft) => ({
                  ...draft,
                  caregiverId: member.userId,
                }))
              }
            />
          ))}

          <Text style={S.h3}>Availability type</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {availabilityStatuses.map((status) => {
              const selected = availabilityDraft.status === status;
              return (
                <Pressable
                  key={status}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() =>
                    setAvailabilityDraft((draft) => ({ ...draft, status }))
                  }
                  style={[
                    S.pill,
                    {
                      paddingHorizontal: 14,
                      paddingVertical: 10,
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
                    {availabilityStatusLabels[status]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Field
            label="Start date (YYYY-MM-DD)"
            value={availabilityDraft.startDate}
            onChange={(value) =>
              setAvailabilityDraft((draft) => ({ ...draft, startDate: value }))
            }
          />
          <Field
            label="Start time (HH:MM)"
            value={availabilityDraft.startTime}
            onChange={(value) =>
              setAvailabilityDraft((draft) => ({ ...draft, startTime: value }))
            }
          />
          <Field
            label="End date (YYYY-MM-DD)"
            value={availabilityDraft.endDate}
            onChange={(value) =>
              setAvailabilityDraft((draft) => ({ ...draft, endDate: value }))
            }
          />
          <Field
            label="End time (HH:MM)"
            value={availabilityDraft.endTime}
            onChange={(value) =>
              setAvailabilityDraft((draft) => ({ ...draft, endTime: value }))
            }
          />
          <Field
            label="Availability note"
            value={availabilityDraft.note}
            onChange={(value) =>
              setAvailabilityDraft((draft) => ({
                ...draft,
                note: value.slice(0, 1000),
              }))
            }
            multiline
          />

          <Button
            title={
              busy === "availability" ? "Saving…" : "Save availability"
            }
            disabled={busy === "availability" || !availabilityDraft.caregiverId}
            onPress={() => void saveAvailability()}
          />
        </Card>
      )}

      {futureAvailability.length ? (
        futureAvailability.slice(0, 30).map((item) => {
          const canManage =
            !readOnly && (owner || item.caregiverId === currentUserId);
          return (
            <Card key={item.id}>
              <View style={S.between}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={S.h3}>{memberName(item.caregiverId)}</Text>
                  <Txt>
                    {availabilityStatusLabels[item.status]}
                  </Txt>
                </View>
                <View
                  style={[
                    S.pill,
                    {
                      backgroundColor:
                        item.status === "unavailable"
                          ? C.redBg
                          : item.status === "preferred"
                            ? "#EAF4EF"
                            : C.lavender,
                    },
                  ]}
                >
                  <Text
                    style={[
                      S.small,
                      { color: item.status === "unavailable" ? C.rose : C.deep },
                    ]}
                  >
                    {availabilityStatusLabels[item.status]}
                  </Text>
                </View>
              </View>
              <Txt style={S.small}>
                {new Date(item.startsAt).toLocaleString()} →{" "}
                {new Date(item.endsAt).toLocaleString()}
              </Txt>
              {Boolean(item.note) && <Txt>{item.note}</Txt>}
              {canManage && (
                <Button
                  title={busy === item.id ? "Removing…" : "Remove window"}
                  secondary
                  disabled={Boolean(busy)}
                  onPress={() => void removeAvailability(item)}
                />
              )}
            </Card>
          );
        })
      ) : (
        <Card>
          <Txt>No upcoming availability windows have been added yet.</Txt>
        </Card>
      )}

      <Section title="Shift swap requests" />
      {swaps.length ? (
        swaps.slice(0, 20).map((swap) => {
          const shift = shiftMap.get(swap.shiftId);
          const incoming =
            swap.status === "open" && swap.requestedTo === currentUserId;
          const outgoing =
            swap.status === "open" && swap.requestedBy === currentUserId;

          return (
            <Card key={swap.id}>
              <View style={S.between}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={S.h3}>{shift?.label || "Caregiver shift"}</Text>
                  <Txt style={S.small}>
                    {memberName(swap.requestedBy)} →{" "}
                    {memberName(swap.requestedTo)}
                  </Txt>
                </View>
                <View style={[S.pill, { backgroundColor: C.lavender }]}>
                  <Text style={[S.small, { color: C.deep }]}>
                    {swap.status}
                  </Text>
                </View>
              </View>
              {shift && (
                <Txt style={S.small}>
                  {new Date(shift.startsAt).toLocaleString()} →{" "}
                  {new Date(shift.endsAt).toLocaleString()}
                </Txt>
              )}
              {Boolean(swap.message) && <Txt>{swap.message}</Txt>}

              {incoming && (
                <View style={{ flexDirection: "row", gap: 9 }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      title={busy === swap.id ? "Updating…" : "Accept"}
                      disabled={Boolean(busy)}
                      onPress={() => void respond(swap, "accepted")}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Decline"
                      secondary
                      disabled={Boolean(busy)}
                      onPress={() => void respond(swap, "declined")}
                    />
                  </View>
                </View>
              )}

              {outgoing && (
                <Button
                  title={busy === swap.id ? "Cancelling…" : "Cancel request"}
                  secondary
                  disabled={Boolean(busy)}
                  onPress={() => void respond(swap, "cancelled")}
                />
              )}
            </Card>
          );
        })
      ) : (
        <Card>
          <Txt>No shift swap requests yet.</Txt>
        </Card>
      )}

      <Card style={{ backgroundColor: C.lavender }}>
        <Icon name="information-circle-outline" />
        <Text style={S.h3}>Coverage planning is coordination support.</Text>
        <Txt>
          Availability and shift warnings help the family organize care. They
          are not emergency monitoring and do not confirm that a caregiver is
          physically present.
        </Txt>
      </Card>
    </Page>
  );
}
