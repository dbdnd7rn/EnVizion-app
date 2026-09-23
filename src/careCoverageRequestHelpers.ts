import type {
  CareCoverageRequest,
  CareCoverageRequestResponse,
} from "./careCoverageRequests";

export type CareCoverageWindowState = "upcoming" | "active" | "ended";

function time(value: string) {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function coverageRequestWindowState(
  request: Pick<CareCoverageRequest, "startsAt" | "endsAt">,
  now = new Date(),
): CareCoverageWindowState {
  const current = now.getTime();
  const start = time(request.startsAt);
  const end = time(request.endsAt);

  if (Number.isFinite(end) && end <= current) return "ended";
  if (Number.isFinite(start) && start <= current) return "active";
  return "upcoming";
}

export function coverageRequestDurationMinutes(
  request: Pick<CareCoverageRequest, "startsAt" | "endsAt">,
) {
  const start = time(request.startsAt);
  const end = time(request.endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.round((end - start) / 60_000);
}

export function coverageRequestDurationLabel(minutes: number) {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const remaining = safe % 60;

  if (!hours) return `${remaining} min`;
  if (!remaining) return `${hours}h`;
  return `${hours}h ${remaining}m`;
}

export function latestCoverageResponseForUser(
  responses: CareCoverageRequestResponse[],
  requestId: string,
  userId: string | null,
) {
  if (!userId) return null;

  return (
    responses
      .filter(
        (item) =>
          item.requestId === requestId && item.responderId === userId,
      )
      .sort(
        (a, b) =>
          time(b.respondedAt) - time(a.respondedAt),
      )[0] ?? null
  );
}

export function coverageRequestCounts(requests: CareCoverageRequest[]) {
  return {
    open: requests.filter((item) => item.status === "open").length,
    filled: requests.filter((item) => item.status === "filled").length,
    cancelled: requests.filter((item) => item.status === "cancelled").length,
  };
}

export function orderedCoverageRequests(
  requests: CareCoverageRequest[],
  now = new Date(),
) {
  const rank = (request: CareCoverageRequest) => {
    if (
      request.status === "open" &&
      coverageRequestWindowState(request, now) !== "ended"
    ) {
      return 0;
    }
    if (request.status === "filled") return 1;
    if (request.status === "open") return 2;
    return 3;
  };

  return [...requests].sort((a, b) => {
    const rankDiff = rank(a) - rank(b);
    if (rankDiff) return rankDiff;

    if (rank(a) === 0) {
      return time(a.startsAt) - time(b.startsAt);
    }

    return time(b.updatedAt) - time(a.updatedAt);
  });
}
