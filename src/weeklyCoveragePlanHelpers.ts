import type { SmartCoverageNeed } from "./smartCoveragePlannerHelpers";
import { localDateTimeToIso, reminderLocalParts } from "./reminderHelpers.ts";

export type WeeklyCoverageDraftSlot = {
  sourceType: "coverage_requirement" | "coverage_request";
  sourceId: string;
  label: string;
  startsAt: string;
  endsAt: string;
  caregiverId: string | null;
};

export function localMondayDate(now = new Date()) {
  const value = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    12,
    0,
    0,
    0,
  );
  const weekday = value.getDay();
  const delta = weekday === 0 ? -6 : 1 - weekday;
  value.setDate(value.getDate() + delta);
  return reminderLocalParts(value.toISOString()).date;
}

export function addLocalDateDays(date: string, days: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return "";
  const [, year, month, day] = match.map(Number);
  const value = new Date(year, month - 1, day + days, 12, 0, 0, 0);
  return reminderLocalParts(value.toISOString()).date;
}

export function weeklyCoverageWindow(weekStart: string) {
  const weekEnd = addLocalDateDays(weekStart, 7);
  const startsAt = localDateTimeToIso(weekStart, "00:00");
  const endsAt = localDateTimeToIso(weekEnd, "00:00");
  if (!startsAt || !endsAt) {
    throw new Error("We could not calculate the selected care week.");
  }
  return { weekStart, weekEnd, startsAt, endsAt };
}

export function weeklyCoverageNeeds(
  needs: SmartCoverageNeed[],
  startsAt: string,
  endsAt: string,
) {
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();

  return needs.filter((need) => {
    if (
      !need.exactWindow ||
      (need.source !== "coverage_requirement" &&
        need.source !== "coverage_request")
    ) {
      return false;
    }

    const needStart = new Date(need.startsAt).getTime();
    const needEnd = new Date(need.endsAt).getTime();

    return (
      Number.isFinite(needStart) &&
      Number.isFinite(needEnd) &&
      needStart >= start &&
      needStart < end &&
      needEnd > start
    );
  });
}

export function weeklyCoverageDraftSlots(
  needs: SmartCoverageNeed[],
  selectedCaregivers: Record<string, string | null>,
): WeeklyCoverageDraftSlot[] {
  return needs.map((need) => {
    const hasSelection = Object.prototype.hasOwnProperty.call(
      selectedCaregivers,
      need.id,
    );

    return {
      sourceType: need.source as
        | "coverage_requirement"
        | "coverage_request",
      sourceId: need.sourceId,
      label: need.label,
      startsAt: need.startsAt,
      endsAt: need.endsAt,
      caregiverId: hasSelection
        ? selectedCaregivers[need.id]
        : need.recommendedUserId,
    };
  });
}

export function defaultWeeklyApprovalDeadlineIso(
  needs: Array<Pick<SmartCoverageNeed, "startsAt">>,
  now = new Date(),
) {
  const current = now.getTime();
  const earliestStart = needs.reduce((earliest, need) => {
    const start = new Date(need.startsAt).getTime();
    if (!Number.isFinite(start) || start <= current) return earliest;
    return earliest === null || start < earliest ? start : earliest;
  }, null as number | null);

  if (earliestStart === null || earliestStart <= current + 2 * 60_000) {
    return null;
  }

  let target = Math.min(
    current + 24 * 60 * 60_000,
    earliestStart - 12 * 60 * 60_000,
  );

  if (target <= current + 60_000) {
    target = current + Math.floor((earliestStart - current) / 2);
  }

  return new Date(target).toISOString();
}

export function weeklyApprovalNudgeState(
  approvalDeadlineAt: string | null,
  now = new Date(),
) {
  if (!approvalDeadlineAt) return null;

  const deadline = new Date(approvalDeadlineAt).getTime();
  const current = now.getTime();
  if (!Number.isFinite(deadline) || !Number.isFinite(current)) return null;

  const remainingMs = deadline - current;
  if (remainingMs <= 0) {
    return {
      stage: "expired" as const,
      remainingMs,
      label: "Response deadline reached",
    };
  }

  if (remainingMs <= 60 * 60_000) {
    return {
      stage: "one_hour" as const,
      remainingMs,
      label: "Final 1-hour reminder window",
    };
  }

  if (remainingMs <= 6 * 60 * 60_000) {
    return {
      stage: "six_hours" as const,
      remainingMs,
      label: "6-hour reminder window",
    };
  }

  return {
    stage: "scheduled" as const,
    remainingMs,
    label: "Automatic reminders at 6 hours and 1 hour",
  };
}

export function weeklyCoverageControlSummary(
  slots: Array<{
    status: "proposed" | "pending" | "accepted" | "declined" | "open_coverage" | "cancelled";
    timedOutAt?: string | null;
  }>,
) {
  return slots.reduce(
    (summary, slot) => {
      summary.total += 1;
      if (slot.status === "accepted") summary.accepted += 1;
      if (slot.status === "pending") summary.pending += 1;
      if (slot.status === "declined") summary.declined += 1;
      if (slot.status === "open_coverage") summary.openCoverage += 1;
      if (slot.timedOutAt) summary.timedOut += 1;
      return summary;
    },
    {
      total: 0,
      accepted: 0,
      pending: 0,
      declined: 0,
      openCoverage: 0,
      timedOut: 0,
    },
  );
}

export function weeklyCoverageResponseCounts(
  statuses: Array<
    "proposed" | "pending" | "accepted" | "declined" | "open_coverage" | "cancelled"
  >,
) {
  return statuses.reduce(
    (counts, status) => {
      counts.total += 1;
      if (status === "accepted") counts.accepted += 1;
      else if (status === "pending") counts.pending += 1;
      else if (status === "declined") counts.declined += 1;
      else if (status === "open_coverage") counts.openCoverage += 1;
      else if (status === "proposed") counts.proposed += 1;
      else counts.cancelled += 1;
      return counts;
    },
    {
      total: 0,
      accepted: 0,
      pending: 0,
      declined: 0,
      openCoverage: 0,
      proposed: 0,
      cancelled: 0,
    },
  );
}
