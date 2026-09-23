import type {
  CareCoverageRequest,
  CareCoverageRequestResponse,
} from "./careCoverageRequests";
import type { CareCoverageRequirementOccurrence } from "./careCoverageRequirements";
import type {
  CareShift,
  CaregiverAvailability,
  CaregiverAvailabilityRule,
} from "./careSchedule";
import {
  intervalsOverlap,
  shiftAvailabilityFit,
  uncoveredUpcomingTasks,
} from "./careScheduleHelpers.ts";
import type { CareTask } from "./careTasks";
import type { CareTeamMember } from "./careTeam";
import type { CoverageBackupFit } from "./careCoverageMatchingHelpers";

export type SmartCoverageNeedSource =
  | "coverage_request"
  | "coverage_requirement"
  | "task";

export type SmartCoverageCandidate = {
  userId: string;
  displayName: string;
  isCurrentUser: boolean;
  fit: CoverageBackupFit;
  declined: boolean;
  assignable: boolean;
  availabilityNote: string;
  overlappingShiftLabel: string;
};

export type SmartCoverageNeed = {
  id: string;
  source: SmartCoverageNeedSource;
  sourceId: string;
  label: string;
  startsAt: string;
  endsAt: string;
  note: string;
  taskDueAt: string | null;
  taskAssignedTo: string | null;
  taskPriority: string | null;
  exactWindow: boolean;
  candidates: SmartCoverageCandidate[];
  recommendedUserId: string | null;
};

function time(value: string) {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : NaN;
}

function oneMinuteAfter(value: string) {
  const parsed = time(value);
  return Number.isFinite(parsed)
    ? new Date(parsed + 60_000).toISOString()
    : value;
}

function fullyCovered(
  startsAt: string,
  endsAt: string,
  shifts: CareShift[],
) {
  const start = time(startsAt);
  const end = time(endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;

  return shifts.some(
    (shift) =>
      shift.status === "scheduled" &&
      time(shift.startsAt) <= start &&
      time(shift.endsAt) >= end,
  );
}

export function uncoveredRequirementSegments(input: {
  occurrence: CareCoverageRequirementOccurrence;
  shifts: CareShift[];
  startsAt: string;
  endsAt: string;
  reservedWindows?: Array<{ startsAt: string; endsAt: string }>;
}) {
  const rangeStart = time(input.startsAt);
  const rangeEnd = time(input.endsAt);
  const occurrenceStart = time(input.occurrence.startsAt);
  const occurrenceEnd = time(input.occurrence.endsAt);

  if (
    ![rangeStart, rangeEnd, occurrenceStart, occurrenceEnd].every(
      Number.isFinite,
    )
  ) {
    return [];
  }

  const start = Math.max(rangeStart, occurrenceStart);
  const end = Math.min(rangeEnd, occurrenceEnd);
  if (end <= start) return [];

  const blocking = [
    ...input.shifts
      .filter((shift) => shift.status === "scheduled")
      .map((shift) => ({
        startsAt: time(shift.startsAt),
        endsAt: time(shift.endsAt),
      })),
    ...(input.reservedWindows ?? []).map((window) => ({
      startsAt: time(window.startsAt),
      endsAt: time(window.endsAt),
    })),
  ]
    .map((window) => ({
      startsAt: Math.max(start, window.startsAt),
      endsAt: Math.min(end, window.endsAt),
    }))
    .filter(
      (window) =>
        Number.isFinite(window.startsAt) &&
        Number.isFinite(window.endsAt) &&
        window.startsAt < window.endsAt,
    )
    .sort((a, b) => a.startsAt - b.startsAt);

  const merged: Array<{ startsAt: number; endsAt: number }> = [];
  for (const window of blocking) {
    const last = merged[merged.length - 1];
    if (!last || window.startsAt > last.endsAt) {
      merged.push({ ...window });
    } else {
      last.endsAt = Math.max(last.endsAt, window.endsAt);
    }
  }

  const gaps: Array<{ startsAt: string; endsAt: string }> = [];
  let cursor = start;
  for (const window of merged) {
    if (window.startsAt > cursor) {
      gaps.push({
        startsAt: new Date(cursor).toISOString(),
        endsAt: new Date(window.startsAt).toISOString(),
      });
    }
    cursor = Math.max(cursor, window.endsAt);
  }

  if (cursor < end) {
    gaps.push({
      startsAt: new Date(cursor).toISOString(),
      endsAt: new Date(end).toISOString(),
    });
  }

  return gaps;
}

function overlappingShift(
  caregiverId: string,
  startsAt: string,
  endsAt: string,
  shifts: CareShift[],
) {
  return (
    shifts.find(
      (shift) =>
        shift.caregiverId === caregiverId &&
        shift.status === "scheduled" &&
        intervalsOverlap(startsAt, endsAt, shift.startsAt, shift.endsAt),
    ) ?? null
  );
}

function matchingAvailabilityNote(
  caregiverId: string,
  startsAt: string,
  endsAt: string,
  availability: CaregiverAvailability[],
) {
  return (
    availability
      .filter(
        (item) =>
          item.caregiverId === caregiverId &&
          intervalsOverlap(startsAt, endsAt, item.startsAt, item.endsAt) &&
          Boolean(item.note.trim()),
      )
      .sort((a, b) => time(b.updatedAt) - time(a.updatedAt))[0]?.note ?? ""
  );
}

function candidateRank(candidate: SmartCoverageCandidate) {
  if (candidate.declined) return 10;
  if (candidate.fit === "preferred") return 0;
  if (candidate.fit === "available") return 1;
  if (candidate.fit === "unspecified") return 2;
  if (candidate.fit === "scheduled_conflict") return 3;
  return 4;
}

export function rankSmartCoverageCandidates(input: {
  startsAt: string;
  endsAt: string;
  members: CareTeamMember[];
  availability: CaregiverAvailability[];
  recurringAvailability: CaregiverAvailabilityRule[];
  shifts: CareShift[];
  responses?: CareCoverageRequestResponse[];
  requestId?: string | null;
  assignedTo?: string | null;
}) {
  const declined = new Set(
    (input.responses ?? [])
      .filter(
        (item) =>
          Boolean(input.requestId) &&
          item.requestId === input.requestId &&
          item.response === "declined" &&
          item.responderId,
      )
      .map((item) => item.responderId as string),
  );

  return input.members
    .filter(
      (member) =>
        member.status === "active" &&
        (member.role === "owner" || member.role === "caregiver") &&
        (!input.assignedTo || member.userId === input.assignedTo),
    )
    .map((member): SmartCoverageCandidate => {
      const shiftConflict = overlappingShift(
        member.userId,
        input.startsAt,
        input.endsAt,
        input.shifts,
      );
      const rawFit = shiftAvailabilityFit(
        {
          caregiverId: member.userId,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
        },
        input.availability,
        input.recurringAvailability,
      );

      let fit: CoverageBackupFit = "unspecified";
      if (shiftConflict) fit = "scheduled_conflict";
      else if (rawFit === "conflict") fit = "unavailable_conflict";
      else if (rawFit === "preferred") fit = "preferred";
      else if (rawFit === "covered") fit = "available";

      const hasDeclined = declined.has(member.userId);
      return {
        userId: member.userId,
        displayName: member.displayName || "Caregiver",
        isCurrentUser: member.isCurrentUser,
        fit,
        declined: hasDeclined,
        assignable:
          !hasDeclined && (fit === "preferred" || fit === "available"),
        availabilityNote: matchingAvailabilityNote(
          member.userId,
          input.startsAt,
          input.endsAt,
          input.availability,
        ),
        overlappingShiftLabel: shiftConflict?.label ?? "",
      };
    })
    .sort((a, b) => {
      const difference = candidateRank(a) - candidateRank(b);
      if (difference) return difference;
      return a.displayName.localeCompare(b.displayName);
    });
}

export function buildSmartCoveragePlan(input: {
  requests: CareCoverageRequest[];
  responses: CareCoverageRequestResponse[];
  requirementOccurrences?: CareCoverageRequirementOccurrence[];
  tasks: CareTask[];
  members: CareTeamMember[];
  availability: CaregiverAvailability[];
  recurringAvailability: CaregiverAvailabilityRule[];
  shifts: CareShift[];
  now?: Date;
  horizonDays?: number;
}) {
  const now = input.now ?? new Date();
  const horizonDays = input.horizonDays ?? 7;
  const current = now.getTime();
  const horizon = current + horizonDays * 24 * 60 * 60_000;

  const requests = input.requests
    .filter((request) => {
      if (request.status !== "open") return false;
      const starts = time(request.startsAt);
      const ends = time(request.endsAt);
      return (
        Number.isFinite(starts) &&
        Number.isFinite(ends) &&
        ends > current &&
        starts <= horizon
      );
    })
    .map((request) => {
      const effectiveStartsAt =
        time(request.startsAt) <= current
          ? now.toISOString()
          : request.startsAt;
      return { request, effectiveStartsAt };
    })
    .filter(
      ({ request, effectiveStartsAt }) =>
        !fullyCovered(effectiveStartsAt, request.endsAt, input.shifts),
    );

  const explicitWindows = requests.map(({ request, effectiveStartsAt }) => ({
    startsAt: effectiveStartsAt,
    endsAt: request.endsAt,
  }));

  const requestNeeds: SmartCoverageNeed[] = requests.map(
    ({ request, effectiveStartsAt }) => {
      const candidates = rankSmartCoverageCandidates({
        startsAt: effectiveStartsAt,
        endsAt: request.endsAt,
        members: input.members,
        availability: input.availability,
        recurringAvailability: input.recurringAvailability,
        shifts: input.shifts,
        responses: input.responses,
        requestId: request.id,
      });

      return {
        id: `coverage:${request.id}`,
        source: "coverage_request",
        sourceId: request.id,
        label: request.label,
        startsAt: effectiveStartsAt,
        endsAt: request.endsAt,
        note: request.note,
        taskDueAt: null,
        taskAssignedTo: null,
        taskPriority: null,
        exactWindow: true,
        candidates,
        recommendedUserId:
          candidates.find((candidate) => candidate.assignable)?.userId ?? null,
      };
    },
  );

  const requirementNeeds: SmartCoverageNeed[] = (
    input.requirementOccurrences ?? []
  ).flatMap((occurrence) =>
    uncoveredRequirementSegments({
      occurrence,
      shifts: input.shifts,
      startsAt: now.toISOString(),
      endsAt: new Date(horizon).toISOString(),
      reservedWindows: explicitWindows,
    }).map((gap, index) => {
      const candidates = rankSmartCoverageCandidates({
        startsAt: gap.startsAt,
        endsAt: gap.endsAt,
        members: input.members,
        availability: input.availability,
        recurringAvailability: input.recurringAvailability,
        shifts: input.shifts,
      });

      return {
        id:
          "requirement:" +
          occurrence.requirementId +
          ":" +
          gap.startsAt +
          ":" +
          index,
        source: "coverage_requirement" as const,
        sourceId: occurrence.requirementId,
        label: occurrence.label,
        startsAt: gap.startsAt,
        endsAt: gap.endsAt,
        note: occurrence.note,
        taskDueAt: null,
        taskAssignedTo: null,
        taskPriority: null,
        exactWindow: true,
        candidates,
        recommendedUserId:
          candidates.find((candidate) => candidate.assignable)?.userId ?? null,
      };
    }),
  );

  const requirementWindows = requirementNeeds.map((need) => ({
    startsAt: need.startsAt,
    endsAt: need.endsAt,
  }));

  const taskNeeds: SmartCoverageNeed[] = uncoveredUpcomingTasks(
    input.tasks,
    input.shifts,
    now,
    horizonDays,
  )
    .filter((task) => {
      const due = time(task.dueAt);
      if (
        explicitWindows.some(
          (window) =>
            time(window.startsAt) <= due && due <= time(window.endsAt),
        )
      ) {
        return false;
      }

      if (
        !task.assignedTo &&
        requirementWindows.some(
          (window) =>
            time(window.startsAt) <= due && due <= time(window.endsAt),
        )
      ) {
        return false;
      }

      return true;
    })
    .map((task) => {
      const startsAt = task.dueAt;
      const endsAt = oneMinuteAfter(task.dueAt);
      const candidates = rankSmartCoverageCandidates({
        startsAt,
        endsAt,
        members: input.members,
        availability: input.availability,
        recurringAvailability: input.recurringAvailability,
        shifts: input.shifts,
        assignedTo: task.assignedTo,
      });

      return {
        id: `task:${task.id}`,
        source: "task",
        sourceId: task.id,
        label: task.title,
        startsAt,
        endsAt,
        note: task.details,
        taskDueAt: task.dueAt,
        taskAssignedTo: task.assignedTo,
        taskPriority: task.priority,
        exactWindow: false,
        candidates,
        recommendedUserId:
          candidates.find((candidate) => candidate.assignable)?.userId ?? null,
      };
    });

  return [...requestNeeds, ...requirementNeeds, ...taskNeeds].sort(
    (a, b) => time(a.startsAt) - time(b.startsAt),
  );
}

export function smartCoveragePlanCounts(needs: SmartCoverageNeed[]) {
  return needs.reduce(
    (counts, need) => {
      counts.total += 1;
      if (need.recommendedUserId) counts.ready += 1;
      else if (
        need.candidates.some(
          (candidate) =>
            !candidate.declined && candidate.fit === "unspecified",
        )
      ) {
        counts.review += 1;
      } else {
        counts.blocked += 1;
      }
      return counts;
    },
    { total: 0, ready: 0, review: 0, blocked: 0 },
  );
}
