import type { CareShift } from "./careSchedule";
import type { CareShiftAttendance } from "./shiftAttendance";

export type ShiftAttendanceState =
  | "upcoming"
  | "ready"
  | "late_no_checkin"
  | "active"
  | "active_late"
  | "completed";

function millis(value: string) {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function attendanceForShift(
  shiftId: string,
  attendance: CareShiftAttendance[],
) {
  return attendance.find((item) => item.shiftId === shiftId) ?? null;
}

export function shiftAttendanceState(
  shift: Pick<CareShift, "startsAt" | "endsAt" | "status">,
  attendance: Pick<
    CareShiftAttendance,
    "checkedInAt" | "checkedOutAt" | "status" | "lateMinutes"
  > | null,
  now = new Date(),
): ShiftAttendanceState {
  if (attendance?.status === "completed" || attendance?.checkedOutAt) {
    return "completed";
  }

  if (attendance?.status === "active") {
    return attendance.lateMinutes > 0 ? "active_late" : "active";
  }

  const start = millis(shift.startsAt);
  const end = millis(shift.endsAt);
  const current = now.getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end)) return "upcoming";
  if (current < start - 60 * 60_000) return "upcoming";
  if (current >= start + 15 * 60_000 && current <= end) {
    return "late_no_checkin";
  }
  if (current >= start - 60 * 60_000 && current <= end) return "ready";
  return "upcoming";
}

export function actualCoverageNow(
  shifts: CareShift[],
  attendance: CareShiftAttendance[],
  now = new Date(),
) {
  const current = now.getTime();
  const scheduledNow = shifts.filter((shift) => {
    if (shift.status !== "scheduled") return false;
    const start = millis(shift.startsAt);
    const end = millis(shift.endsAt);
    return start <= current && end >= current;
  });

  const checkedInNow = scheduledNow.filter((shift) => {
    const item = attendanceForShift(shift.id, attendance);
    return Boolean(item && item.status === "active" && !item.checkedOutAt);
  });

  const missingCheckIn = scheduledNow.filter(
    (shift) => !checkedInNow.some((item) => item.id === shift.id),
  );

  return { scheduledNow, checkedInNow, missingCheckIn };
}

export function attendanceDurationMinutes(
  attendance: Pick<CareShiftAttendance, "checkedInAt" | "checkedOutAt">,
  now = new Date(),
) {
  const start = millis(attendance.checkedInAt);
  const end = attendance.checkedOutAt ? millis(attendance.checkedOutAt) : now.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.floor((end - start) / 60_000);
}
