import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCoverageBackupMatches,
  coverageBackupFitLabel,
  coverageEscalationLabel,
  coverageEscalationLevel,
  escalationEligibleMatches,
} from "../src/careCoverageMatchingHelpers.ts";

function request(overrides: Record<string, unknown> = {}) {
  return {
    id: "request-1",
    careRecipientId: "care-1",
    createdBy: "owner-1",
    label: "Open caregiver coverage",
    startsAt: "2026-09-23T20:00:00.000Z",
    endsAt: "2026-09-23T22:00:00.000Z",
    note: "",
    status: "open",
    claimedBy: null,
    filledShiftId: null,
    claimedAt: null,
    cancelledAt: null,
    createdAt: "2026-09-23T08:00:00.000Z",
    updatedAt: "2026-09-23T08:00:00.000Z",
    ...overrides,
  } as any;
}

function member(
  userId: string,
  displayName: string,
  role: "owner" | "caregiver" | "viewer" = "caregiver",
) {
  return {
    userId,
    displayName,
    email: "",
    role,
    status: "active",
    invitedAt: null,
    acceptedAt: "2026-09-01T00:00:00.000Z",
    revokedAt: null,
    isCurrentUser: false,
  } as any;
}

function availability(
  id: string,
  caregiverId: string,
  status: "available" | "preferred" | "unavailable",
  startsAt = "2026-09-23T19:00:00.000Z",
  endsAt = "2026-09-23T23:00:00.000Z",
) {
  return {
    id,
    careRecipientId: "care-1",
    caregiverId,
    createdBy: caregiverId,
    startsAt,
    endsAt,
    status,
    note: "",
    createdAt: "2026-09-22T00:00:00.000Z",
    updatedAt: "2026-09-22T00:00:00.000Z",
  } as any;
}

function shift(
  id: string,
  caregiverId: string,
  startsAt = "2026-09-23T20:30:00.000Z",
  endsAt = "2026-09-23T21:30:00.000Z",
) {
  return {
    id,
    careRecipientId: "care-1",
    caregiverId,
    createdBy: caregiverId,
    label: "Existing shift",
    startsAt,
    endsAt,
    status: "scheduled",
    note: "",
    completedAt: null,
    cancelledAt: null,
    createdAt: "2026-09-22T00:00:00.000Z",
    updatedAt: "2026-09-22T00:00:00.000Z",
  } as any;
}

test("coverage escalation progresses through 12h, 4h, 1h and active states", () => {
  const row = request();

  assert.equal(
    coverageEscalationLevel(row, new Date("2026-09-23T07:59:00.000Z")),
    "standard",
  );
  assert.equal(
    coverageEscalationLevel(row, new Date("2026-09-23T08:00:00.000Z")),
    "watch",
  );
  assert.equal(
    coverageEscalationLevel(row, new Date("2026-09-23T16:00:00.000Z")),
    "getting_close",
  );
  assert.equal(
    coverageEscalationLevel(row, new Date("2026-09-23T19:00:00.000Z")),
    "starts_soon",
  );
  assert.equal(
    coverageEscalationLevel(row, new Date("2026-09-23T20:30:00.000Z")),
    "active_unfilled",
  );
  assert.equal(
    coverageEscalationLevel(row, new Date("2026-09-23T22:00:00.000Z")),
    "expired",
  );
});

test("backup matching ranks preferred then available then unspecified", () => {
  const matches = buildCoverageBackupMatches({
    request: request(),
    members: [
      member("owner-1", "Publisher", "owner"),
      member("caregiver-c", "Casey"),
      member("caregiver-a", "Amina"),
      member("caregiver-b", "Banda"),
      member("viewer-1", "Viewer", "viewer"),
    ],
    availability: [
      availability("a1", "caregiver-a", "preferred"),
      availability("a2", "caregiver-b", "available"),
    ],
    recurringAvailability: [],
    shifts: [],
    responses: [],
  });

  assert.deepEqual(
    matches.map((item) => [item.userId, item.fit]),
    [
      ["caregiver-a", "preferred"],
      ["caregiver-b", "available"],
      ["caregiver-c", "unspecified"],
    ],
  );
  assert.equal(
    coverageBackupFitLabel(matches[0].fit),
    "Preferred for this window",
  );
});

test("explicit unavailable overlap overrides a preferred availability window", () => {
  const matches = buildCoverageBackupMatches({
    request: request(),
    members: [member("caregiver-a", "Amina")],
    availability: [
      availability("a1", "caregiver-a", "preferred"),
      availability(
        "a2",
        "caregiver-a",
        "unavailable",
        "2026-09-23T21:00:00.000Z",
        "2026-09-23T21:30:00.000Z",
      ),
    ],
    recurringAvailability: [],
    shifts: [],
    responses: [],
  });

  assert.equal(matches[0].fit, "unavailable_conflict");
});

test("existing scheduled shift takes precedence over availability match", () => {
  const matches = buildCoverageBackupMatches({
    request: request(),
    members: [member("caregiver-a", "Amina")],
    availability: [availability("a1", "caregiver-a", "preferred")],
    recurringAvailability: [],
    shifts: [shift("shift-1", "caregiver-a")],
    responses: [],
  });

  assert.equal(matches[0].fit, "scheduled_conflict");
  assert.equal(matches[0].overlappingShiftLabel, "Existing shift");
});

test("declined caregiver stays visible but is removed from escalation targets", () => {
  const matches = buildCoverageBackupMatches({
    request: request(),
    members: [
      member("caregiver-a", "Amina"),
      member("caregiver-b", "Banda"),
    ],
    availability: [
      availability("a1", "caregiver-a", "preferred"),
      availability("a2", "caregiver-b", "available"),
    ],
    recurringAvailability: [],
    shifts: [],
    responses: [
      {
        id: "response-1",
        careRecipientId: "care-1",
        requestId: "request-1",
        responderId: "caregiver-a",
        response: "declined",
        note: "",
        respondedAt: "2026-09-23T09:00:00.000Z",
      } as any,
    ],
  });

  assert.equal(matches.find((item) => item.userId === "caregiver-a")?.declined, true);
  assert.deepEqual(
    escalationEligibleMatches(matches, "getting_close").map(
      (item) => item.userId,
    ),
    ["caregiver-b"],
  );
});

test("escalation stages widen backup targets without including conflicts", () => {
  const matches = buildCoverageBackupMatches({
    request: request(),
    members: [
      member("preferred", "Preferred"),
      member("available", "Available"),
      member("unknown", "Unknown"),
      member("unavailable", "Unavailable"),
      member("busy", "Busy"),
    ],
    availability: [
      availability("a1", "preferred", "preferred"),
      availability("a2", "available", "available"),
      availability("a3", "unavailable", "unavailable"),
      availability("a4", "busy", "preferred"),
    ],
    recurringAvailability: [],
    shifts: [shift("shift-busy", "busy")],
    responses: [],
  });

  assert.deepEqual(
    escalationEligibleMatches(matches, "watch").map((item) => item.userId),
    ["preferred"],
  );
  assert.deepEqual(
    escalationEligibleMatches(matches, "getting_close").map(
      (item) => item.userId,
    ),
    ["preferred", "available"],
  );
  assert.deepEqual(
    escalationEligibleMatches(matches, "starts_soon").map(
      (item) => item.userId,
    ),
    ["preferred", "available", "unknown"],
  );
  assert.equal(
    coverageEscalationLabel("starts_soon"),
    "Starts within 1 hour",
  );
});
