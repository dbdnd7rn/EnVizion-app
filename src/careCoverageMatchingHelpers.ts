import type {
  CareCoverageRequest,
  CareCoverageRequestResponse,
} from "./careCoverageRequests";
import type { CareShift, CaregiverAvailability } from "./careSchedule";
import {
  intervalsOverlap,
  shiftAvailabilityFit,
} from "./careScheduleHelpers.ts";
import type { CareTeamMember } from "./careTeam";

export type CoverageEscalationLevel =
  | "standard"
  | "watch"
  | "getting_close"
  | "starts_soon"
  | "active_unfilled"
  | "expired";

export type CoverageBackupFit =
  | "preferred"
  | "available"
  | "unspecified"
  | "scheduled_conflict"
  | "unavailable_conflict";

export type CoverageBackupMatch = {
  userId: string;
  displayName: string;
  isCurrentUser: boolean;
  fit: CoverageBackupFit;
  declined: boolean;
  availabilityNote: string;
  overlappingShiftLabel: string;
};

function time(value: string) {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function coverageEscalationLevel(
  request: Pick<CareCoverageRequest, "startsAt" | "endsAt" | "status">,
  now = new Date(),
): CoverageEscalationLevel {
  if (request.status !== "open") return "standard";

  const current = now.getTime();
  const starts = time(request.startsAt);
  const ends = time(request.endsAt);

  if (!Number.isFinite(starts) || !Number.isFinite(ends)) return "standard";
  if (ends <= current) return "expired";
  if (starts <= current) return "active_unfilled";

  const minutes = (starts - current) / 60_000;
  if (minutes <= 60) return "starts_soon";
  if (minutes <= 4 * 60) return "getting_close";
  if (minutes <= 12 * 60) return "watch";
  return "standard";
}

export function coverageEscalationLabel(level: CoverageEscalationLevel) {
  if (level === "active_unfilled") return "Coverage window is active";
  if (level === "starts_soon") return "Starts within 1 hour";
  if (level === "getting_close") return "Starts within 4 hours";
  if (level === "watch") return "Backup search active";
  if (level === "expired") return "Coverage window ended";
  return "Open coverage";
}

export function coverageBackupFitLabel(fit: CoverageBackupFit) {
  if (fit === "preferred") return "Preferred for this window";
  if (fit === "available") return "Available for this window";
  if (fit === "scheduled_conflict") return "Already scheduled elsewhere";
  if (fit === "unavailable_conflict") return "Marked unavailable";
  return "No availability recorded";
}

function overlappingShift(
  caregiverId: string,
  request: Pick<CareCoverageRequest, "startsAt" | "endsAt">,
  shifts: CareShift[],
) {
  return (
    shifts.find(
      (shift) =>
        shift.caregiverId === caregiverId &&
        shift.status === "scheduled" &&
        intervalsOverlap(
          request.startsAt,
          request.endsAt,
          shift.startsAt,
          shift.endsAt,
        ),
    ) ?? null
  );
}

function matchingAvailabilityNote(
  caregiverId: string,
  request: Pick<CareCoverageRequest, "startsAt" | "endsAt">,
  availability: CaregiverAvailability[],
) {
  const rows = availability
    .filter(
      (item) =>
        item.caregiverId === caregiverId &&
        intervalsOverlap(
          request.startsAt,
          request.endsAt,
          item.startsAt,
          item.endsAt,
        ) &&
        Boolean(item.note.trim()),
    )
    .sort((a, b) => time(b.updatedAt) - time(a.updatedAt));

  return rows[0]?.note ?? "";
}

export function buildCoverageBackupMatches(input: {
  request: CareCoverageRequest;
  members: CareTeamMember[];
  availability: CaregiverAvailability[];
  shifts: CareShift[];
  responses: CareCoverageRequestResponse[];
}) {
  const declined = new Set(
    input.responses
      .filter(
        (item) =>
          item.requestId === input.request.id &&
          item.response === "declined" &&
          item.responderId,
      )
      .map((item) => item.responderId as string),
  );

  const matches: CoverageBackupMatch[] = input.members
    .filter(
      (member) =>
        member.status === "active" &&
        (member.role === "owner" || member.role === "caregiver") &&
        member.userId !== input.request.createdBy,
    )
    .map((member) => {
      const shiftConflict = overlappingShift(
        member.userId,
        input.request,
        input.shifts,
      );

      const rawFit = shiftAvailabilityFit(
        {
          caregiverId: member.userId,
          startsAt: input.request.startsAt,
          endsAt: input.request.endsAt,
        },
        input.availability,
      );

      let fit: CoverageBackupFit = "unspecified";
      if (shiftConflict) fit = "scheduled_conflict";
      else if (rawFit === "conflict") fit = "unavailable_conflict";
      else if (rawFit === "preferred") fit = "preferred";
      else if (rawFit === "covered") fit = "available";

      return {
        userId: member.userId,
        displayName: member.displayName || "Caregiver",
        isCurrentUser: member.isCurrentUser,
        fit,
        declined: declined.has(member.userId),
        availabilityNote: matchingAvailabilityNote(
          member.userId,
          input.request,
          input.availability,
        ),
        overlappingShiftLabel: shiftConflict?.label ?? "",
      };
    });

  const rank = (match: CoverageBackupMatch) => {
    if (match.declined) return 10;
    if (match.fit === "preferred") return 0;
    if (match.fit === "available") return 1;
    if (match.fit === "unspecified") return 2;
    if (match.fit === "scheduled_conflict") return 3;
    return 4;
  };

  return matches.sort((a, b) => {
    const difference = rank(a) - rank(b);
    if (difference) return difference;
    return a.displayName.localeCompare(b.displayName);
  });
}

export function escalationEligibleMatches(
  matches: CoverageBackupMatch[],
  level: CoverageEscalationLevel,
) {
  return matches.filter((match) => {
    if (match.declined) return false;
    if (
      match.fit === "scheduled_conflict" ||
      match.fit === "unavailable_conflict"
    ) {
      return false;
    }

    if (level === "watch") return match.fit === "preferred";
    if (level === "getting_close") {
      return match.fit === "preferred" || match.fit === "available";
    }
    if (level === "starts_soon" || level === "active_unfilled") {
      return true;
    }

    return false;
  });
}
