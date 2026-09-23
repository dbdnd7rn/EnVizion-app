import type { CareShift } from "./careSchedule";
import type {
  CaregiverShiftSession,
} from "./onShiftCaregiver";
import type {
  CareShiftHandoff,
  CareShiftHandoffAcknowledgement,
} from "./shiftBoard";
import type { CareShiftAttendance } from "./shiftAttendance";

export type CareCoverageBridgeState =
  | "covered_now"
  | "seamless_transition"
  | "gap_ahead"
  | "overlap_ahead"
  | "uncovered_now"
  | "no_next_shift";

export type CareCoverageBridge = {
  state: CareCoverageBridgeState;
  currentCaregiverId: string | null;
  currentSession: CaregiverShiftSession | null;
  currentCoverageEndsAt: string | null;
  currentCoverageSource: "takeover" | "attendance" | "scheduled" | "none";
  nextShift: CareShift | null;
  minutesUntilNext: number | null;
  gapMinutes: number;
  overlapMinutes: number;
  pendingHandoff: CareShiftHandoff | null;
  handoffMatchesNextCaregiver: boolean | null;
};

function ms(value: string | null | undefined) {
  const parsed = new Date(String(value ?? "")).getTime();
  return Number.isFinite(parsed) ? parsed : NaN;
}

function latestActiveSession(
  sessions: CaregiverShiftSession[],
) {
  return (
    sessions
      .filter((session) => !session.endedAt)
      .sort((a, b) => ms(b.startedAt) - ms(a.startedAt))[0] ?? null
  );
}

function activeAttendanceRows(
  attendance: CareShiftAttendance[],
) {
  return attendance
    .filter((item) => item.status === "active" && !item.checkedOutAt)
    .sort((a, b) => ms(b.checkedInAt) - ms(a.checkedInAt));
}

function pendingHandoff(
  handoffs: CareShiftHandoff[],
  acknowledgements: CareShiftHandoffAcknowledgement[],
) {
  const acknowledged = new Set(
    acknowledgements.map((item) => item.handoffId),
  );

  return (
    handoffs
      .filter(
        (handoff) =>
          handoff.requiresAcknowledgement &&
          !acknowledged.has(handoff.id),
      )
      .sort((a, b) => ms(b.createdAt) - ms(a.createdAt))[0] ?? null
  );
}

function scheduledNow(shifts: CareShift[], nowMs: number) {
  return shifts.filter(
    (shift) =>
      shift.status === "scheduled" &&
      ms(shift.startsAt) <= nowMs &&
      ms(shift.endsAt) >= nowMs,
  );
}

function nextScheduledShift(shifts: CareShift[], nowMs: number) {
  return (
    shifts
      .filter(
        (shift) =>
          shift.status === "scheduled" &&
          ms(shift.startsAt) > nowMs,
      )
      .sort((a, b) => ms(a.startsAt) - ms(b.startsAt))[0] ?? null
  );
}

export function buildCareCoverageBridge(input: {
  sessions: CaregiverShiftSession[];
  attendance: CareShiftAttendance[];
  shifts: CareShift[];
  handoffs: CareShiftHandoff[];
  acknowledgements: CareShiftHandoffAcknowledgement[];
  now?: Date;
}): CareCoverageBridge {
  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  const currentSession = latestActiveSession(input.sessions);
  const activeAttendance = activeAttendanceRows(input.attendance);
  const shiftById = new Map(input.shifts.map((shift) => [shift.id, shift]));
  const currentScheduled = scheduledNow(input.shifts, nowMs);
  const pending = pendingHandoff(input.handoffs, input.acknowledgements);

  let currentCaregiverId = currentSession?.caregiverId ?? null;
  let currentCoverageSource: CareCoverageBridge["currentCoverageSource"] =
    currentSession ? "takeover" : "none";
  let currentCoverageEndsAt: string | null = null;

  const attendanceForCurrent =
    activeAttendance.find(
      (item) =>
        !currentCaregiverId || item.caregiverId === currentCaregiverId,
    ) ?? activeAttendance[0] ?? null;

  if (!currentCaregiverId && attendanceForCurrent) {
    currentCaregiverId = attendanceForCurrent.caregiverId;
    currentCoverageSource = "attendance";
  }

  if (attendanceForCurrent) {
    const attendanceShift = shiftById.get(attendanceForCurrent.shiftId) ?? null;
    if (attendanceShift) {
      currentCoverageEndsAt = attendanceShift.endsAt;
      if (!currentSession) currentCoverageSource = "attendance";
    }
  }

  if (currentCaregiverId && !currentCoverageEndsAt) {
    const matchingScheduled = currentScheduled
      .filter((shift) => shift.caregiverId === currentCaregiverId)
      .sort((a, b) => ms(b.endsAt) - ms(a.endsAt))[0];

    if (matchingScheduled) {
      currentCoverageEndsAt = matchingScheduled.endsAt;
      if (!currentSession && !attendanceForCurrent) {
        currentCoverageSource = "scheduled";
      }
    }
  }

  if (!currentCaregiverId && currentScheduled.length) {
    const firstScheduled = [...currentScheduled].sort(
      (a, b) => ms(a.endsAt) - ms(b.endsAt),
    )[0];
    currentCaregiverId = firstScheduled.caregiverId;
    currentCoverageEndsAt = firstScheduled.endsAt;
    currentCoverageSource = "scheduled";
  }

  const nextShift = nextScheduledShift(input.shifts, nowMs);
  const minutesUntilNext = nextShift
    ? Math.max(0, Math.ceil((ms(nextShift.startsAt) - nowMs) / 60_000))
    : null;

  const actuallyCoveredNow =
    Boolean(currentSession) || activeAttendance.length > 0;

  let state: CareCoverageBridgeState;
  let gapMinutes = 0;
  let overlapMinutes = 0;

  if (!actuallyCoveredNow) {
    state = "uncovered_now";
    if (nextShift) {
      gapMinutes = Math.max(
        0,
        Math.ceil((ms(nextShift.startsAt) - nowMs) / 60_000),
      );
    }
  } else if (!nextShift) {
    state = "no_next_shift";
  } else if (!currentCoverageEndsAt) {
    state = "covered_now";
  } else {
    const deltaMinutes =
      (ms(nextShift.startsAt) - ms(currentCoverageEndsAt)) / 60_000;

    if (deltaMinutes > 5) {
      state = "gap_ahead";
      gapMinutes = Math.ceil(deltaMinutes);
    } else if (deltaMinutes < -5) {
      state = "overlap_ahead";
      overlapMinutes = Math.ceil(Math.abs(deltaMinutes));
    } else {
      state = "seamless_transition";
    }
  }

  const handoffMatchesNextCaregiver =
    pending && pending.handoffTo && nextShift
      ? pending.handoffTo === nextShift.caregiverId
      : null;

  return {
    state,
    currentCaregiverId,
    currentSession,
    currentCoverageEndsAt,
    currentCoverageSource,
    nextShift,
    minutesUntilNext,
    gapMinutes,
    overlapMinutes,
    pendingHandoff: pending,
    handoffMatchesNextCaregiver,
  };
}

export function coverageBridgeStateLabel(state: CareCoverageBridgeState) {
  if (state === "seamless_transition") return "Seamless transition planned";
  if (state === "gap_ahead") return "Coverage gap ahead";
  if (state === "overlap_ahead") return "Coverage overlap planned";
  if (state === "uncovered_now") return "No confirmed coverage right now";
  if (state === "no_next_shift") return "No next shift recorded";
  return "Caregiver coverage is active";
}

export function coverageMinutesLabel(minutes: number) {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const remaining = safe % 60;

  if (!hours) return `${remaining} min`;
  if (!remaining) return `${hours}h`;
  return `${hours}h ${remaining}m`;
}
