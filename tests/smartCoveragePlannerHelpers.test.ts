import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSmartCoveragePlan,
  rankSmartCoverageCandidates,
  smartCoveragePlanCounts,
} from "../src/smartCoveragePlannerHelpers.ts";

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
    acceptedAt: "2026-09-01T00:00:00Z",
    revokedAt: null,
    isCurrentUser: false,
  } as any;
}

function request(overrides: Record<string, unknown> = {}) {
  return {
    id: "request-1",
    careRecipientId: "care-1",
    createdBy: "owner-1",
    label: "Evening coverage",
    startsAt: "2026-09-24T16:00:00Z",
    endsAt: "2026-09-24T18:00:00Z",
    note: "",
    status: "open",
    claimedBy: null,
    filledShiftId: null,
    claimedAt: null,
    cancelledAt: null,
    createdAt: "2026-09-23T08:00:00Z",
    updatedAt: "2026-09-23T08:00:00Z",
    ...overrides,
  } as any;
}

function availability(
  id: string,
  caregiverId: string,
  status: "available" | "preferred" | "unavailable",
  startsAt = "2026-09-24T15:00:00Z",
  endsAt = "2026-09-24T19:00:00Z",
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
    createdAt: "2026-09-23T00:00:00Z",
    updatedAt: "2026-09-23T00:00:00Z",
  } as any;
}

function recurringRule(
  caregiverId: string,
  status: "available" | "preferred" | "unavailable",
  overrides: Record<string, unknown> = {},
) {
  return {
    id: "rule-" + caregiverId + "-" + status,
    careRecipientId: "care-1",
    caregiverId,
    createdBy: caregiverId,
    daysOfWeek: [4],
    startLocalTime: "17:00",
    endLocalTime: "21:00",
    timezone: "Africa/Blantyre",
    status,
    effectiveFrom: "2026-09-01",
    effectiveUntil: null,
    note: "",
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
    ...overrides,
  } as any;
}

function shift(
  id: string,
  caregiverId: string,
  startsAt = "2026-09-24T16:00:00Z",
  endsAt = "2026-09-24T18:00:00Z",
) {
  return {
    id,
    careRecipientId: "care-1",
    caregiverId,
    createdBy: "owner-1",
    label: "Scheduled caregiver shift",
    startsAt,
    endsAt,
    status: "scheduled",
    note: "",
    completedAt: null,
    cancelledAt: null,
    createdAt: "2026-09-23T00:00:00Z",
    updatedAt: "2026-09-23T00:00:00Z",
  } as any;
}

function task(overrides: Record<string, unknown> = {}) {
  return {
    id: "task-1",
    careRecipientId: "care-1",
    createdBy: "owner-1",
    assignedTo: null,
    category: "other",
    title: "Evening care task",
    details: "",
    dueAt: "2026-09-24T17:00:00Z",
    timezone: "Africa/Blantyre",
    recurrence: "none",
    priority: "normal",
    status: "open",
    medicationId: null,
    appointmentId: null,
    contactId: null,
    communicationId: null,
    lastCompletedAt: null,
    completedAt: null,
    cancelledAt: null,
    createdAt: "2026-09-23T00:00:00Z",
    updatedAt: "2026-09-23T00:00:00Z",
    ...overrides,
  } as any;
}

const now = new Date("2026-09-23T10:00:00Z");

test("smart planner ranks preferred before available and review-only candidates", () => {
  const candidates = rankSmartCoverageCandidates({
    startsAt: "2026-09-24T16:00:00Z",
    endsAt: "2026-09-24T18:00:00Z",
    members: [
      member("unknown", "Unknown"),
      member("available", "Available"),
      member("preferred", "Preferred"),
    ],
    availability: [
      availability("a1", "preferred", "preferred"),
      availability("a2", "available", "available"),
    ],
    recurringAvailability: [],
    shifts: [],
  });

  assert.deepEqual(
    candidates.map((candidate) => [
      candidate.userId,
      candidate.fit,
      candidate.assignable,
    ]),
    [
      ["preferred", "preferred", true],
      ["available", "available", true],
      ["unknown", "unspecified", false],
    ],
  );
});

test("fully covered open request is not shown as a planning need", () => {
  const plan = buildSmartCoveragePlan({
    requests: [request()],
    responses: [],
    tasks: [],
    members: [member("caregiver-1", "Amina")],
    availability: [],
    recurringAvailability: [],
    shifts: [shift("shift-1", "caregiver-1")],
    now,
  });

  assert.deepEqual(plan, []);
});

test("task inside an explicit open coverage window is not duplicated", () => {
  const plan = buildSmartCoveragePlan({
    requests: [request()],
    responses: [],
    tasks: [task()],
    members: [member("caregiver-1", "Amina")],
    availability: [availability("a1", "caregiver-1", "available")],
    recurringAvailability: [],
    shifts: [],
    now,
  });

  assert.equal(plan.length, 1);
  assert.equal(plan[0].source, "coverage_request");
});

test("assigned task only evaluates the assigned caregiver", () => {
  const plan = buildSmartCoveragePlan({
    requests: [],
    responses: [],
    tasks: [task({ assignedTo: "assigned" })],
    members: [
      member("assigned", "Assigned"),
      member("backup", "Backup"),
    ],
    availability: [
      availability(
        "a1",
        "assigned",
        "preferred",
        "2026-09-24T16:00:00Z",
        "2026-09-24T18:00:00Z",
      ),
      availability(
        "a2",
        "backup",
        "preferred",
        "2026-09-24T16:00:00Z",
        "2026-09-24T18:00:00Z",
      ),
    ],
    recurringAvailability: [],
    shifts: [],
    now,
  });

  assert.equal(plan.length, 1);
  assert.deepEqual(
    plan[0].candidates.map((candidate) => candidate.userId),
    ["assigned"],
  );
  assert.equal(plan[0].recommendedUserId, "assigned");
});

test("declined caregiver is not recommended and next available caregiver is used", () => {
  const plan = buildSmartCoveragePlan({
    requests: [request()],
    responses: [
      {
        id: "response-1",
        careRecipientId: "care-1",
        requestId: "request-1",
        responderId: "preferred",
        response: "declined",
        note: "",
        respondedAt: "2026-09-23T11:00:00Z",
      } as any,
    ],
    tasks: [],
    members: [
      member("preferred", "Preferred"),
      member("available", "Available"),
    ],
    availability: [
      availability("a1", "preferred", "preferred"),
      availability("a2", "available", "available"),
    ],
    recurringAvailability: [],
    shifts: [],
    now,
  });

  assert.equal(plan[0].recommendedUserId, "available");
  assert.equal(
    plan[0].candidates.find((candidate) => candidate.userId === "preferred")
      ?.assignable,
    false,
  );
});

test("recurring unavailable overrides recurring preferred and blocks one-tap assignment", () => {
  const candidates = rankSmartCoverageCandidates({
    startsAt: "2026-09-24T16:00:00Z",
    endsAt: "2026-09-24T18:00:00Z",
    members: [member("caregiver-1", "Amina")],
    availability: [],
    recurringAvailability: [
      recurringRule("caregiver-1", "preferred"),
      recurringRule("caregiver-1", "unavailable", {
        startLocalTime: "18:30",
        endLocalTime: "19:00",
      }),
    ],
    shifts: [],
  });

  assert.equal(candidates[0].fit, "unavailable_conflict");
  assert.equal(candidates[0].assignable, false);
});

test("planner summary separates ready, review, and blocked needs", () => {
  const plan = buildSmartCoveragePlan({
    requests: [
      request({ id: "ready" }),
      request({
        id: "review",
        startsAt: "2026-09-25T16:00:00Z",
        endsAt: "2026-09-25T18:00:00Z",
      }),
      request({
        id: "blocked",
        startsAt: "2026-09-26T16:00:00Z",
        endsAt: "2026-09-26T18:00:00Z",
      }),
    ],
    responses: [],
    tasks: [],
    members: [
      member("ready-user", "Ready"),
      member("review-user", "Review"),
      member("blocked-user", "Blocked"),
    ],
    availability: [
      availability("ready-a", "ready-user", "available"),
      availability(
        "blocked-a",
        "blocked-user",
        "unavailable",
        "2026-09-26T15:00:00Z",
        "2026-09-26T19:00:00Z",
      ),
      availability(
        "blocked-ready",
        "ready-user",
        "unavailable",
        "2026-09-26T15:00:00Z",
        "2026-09-26T19:00:00Z",
      ),
      availability(
        "blocked-review",
        "review-user",
        "unavailable",
        "2026-09-26T15:00:00Z",
        "2026-09-26T19:00:00Z",
      ),
    ],
    recurringAvailability: [],
    shifts: [
      shift(
        "ready-conflict-review",
        "ready-user",
        "2026-09-25T16:00:00Z",
        "2026-09-25T17:00:00Z",
      ),
      shift(
        "review-conflict-blocked",
        "review-user",
        "2026-09-26T16:00:00Z",
        "2026-09-26T17:00:00Z",
      ),
    ],
    now,
  });

  const counts = smartCoveragePlanCounts(plan);
  assert.equal(counts.total, 3);
  assert.equal(counts.ready, 1);
  assert.equal(counts.review, 1);
  assert.equal(counts.blocked, 1);
});
