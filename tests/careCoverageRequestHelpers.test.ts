import test from "node:test";
import assert from "node:assert/strict";
import {
  coverageRequestCounts,
  coverageRequestDurationLabel,
  coverageRequestDurationMinutes,
  coverageRequestWindowState,
  latestCoverageResponseForUser,
  orderedCoverageRequests,
} from "../src/careCoverageRequestHelpers.ts";

function request(
  id: string,
  status: "open" | "filled" | "cancelled",
  startsAt: string,
  endsAt: string,
  updatedAt = "2026-09-23T08:00:00.000Z",
) {
  return {
    id,
    careRecipientId: "care-1",
    createdBy: "owner-1",
    label: id,
    startsAt,
    endsAt,
    note: "",
    status,
    claimedBy: status === "filled" ? "caregiver-1" : null,
    filledShiftId: status === "filled" ? "shift-1" : null,
    claimedAt: status === "filled" ? updatedAt : null,
    cancelledAt: status === "cancelled" ? updatedAt : null,
    createdAt: "2026-09-23T07:00:00.000Z",
    updatedAt,
  } as any;
}

test("coverage request window state distinguishes upcoming active and ended", () => {
  const now = new Date("2026-09-23T10:00:00.000Z");

  assert.equal(
    coverageRequestWindowState(
      request(
        "upcoming",
        "open",
        "2026-09-23T11:00:00.000Z",
        "2026-09-23T12:00:00.000Z",
      ),
      now,
    ),
    "upcoming",
  );

  assert.equal(
    coverageRequestWindowState(
      request(
        "active",
        "open",
        "2026-09-23T09:00:00.000Z",
        "2026-09-23T11:00:00.000Z",
      ),
      now,
    ),
    "active",
  );

  assert.equal(
    coverageRequestWindowState(
      request(
        "ended",
        "open",
        "2026-09-23T08:00:00.000Z",
        "2026-09-23T10:00:00.000Z",
      ),
      now,
    ),
    "ended",
  );
});

test("coverage request duration stays caregiver friendly", () => {
  const item = request(
    "duration",
    "open",
    "2026-09-23T10:00:00.000Z",
    "2026-09-23T12:45:00.000Z",
  );

  assert.equal(coverageRequestDurationMinutes(item), 165);
  assert.equal(coverageRequestDurationLabel(165), "2h 45m");
  assert.equal(coverageRequestDurationLabel(45), "45 min");
});

test("latest caregiver response wins for a request", () => {
  const responses = [
    {
      id: "old",
      requestId: "request-1",
      responderId: "caregiver-1",
      response: "declined",
      respondedAt: "2026-09-23T08:00:00.000Z",
    },
    {
      id: "new",
      requestId: "request-1",
      responderId: "caregiver-1",
      response: "accepted",
      respondedAt: "2026-09-23T09:00:00.000Z",
    },
  ] as any;

  assert.equal(
    latestCoverageResponseForUser(
      responses,
      "request-1",
      "caregiver-1",
    )?.id,
    "new",
  );
});

test("coverage request counts separate open filled and cancelled", () => {
  const rows = [
    request("open", "open", "2026-09-23T11:00:00.000Z", "2026-09-23T12:00:00.000Z"),
    request("filled", "filled", "2026-09-23T11:00:00.000Z", "2026-09-23T12:00:00.000Z"),
    request("cancelled", "cancelled", "2026-09-23T11:00:00.000Z", "2026-09-23T12:00:00.000Z"),
  ];

  assert.deepEqual(coverageRequestCounts(rows), {
    open: 1,
    filled: 1,
    cancelled: 1,
  });
});

test("request board puts claimable open windows before history", () => {
  const now = new Date("2026-09-23T10:00:00.000Z");
  const rows = [
    request("filled", "filled", "2026-09-23T08:00:00.000Z", "2026-09-23T09:00:00.000Z"),
    request("later", "open", "2026-09-23T13:00:00.000Z", "2026-09-23T14:00:00.000Z"),
    request("sooner", "open", "2026-09-23T11:00:00.000Z", "2026-09-23T12:00:00.000Z"),
    request("expired", "open", "2026-09-23T08:00:00.000Z", "2026-09-23T09:00:00.000Z"),
  ];

  assert.deepEqual(
    orderedCoverageRequests(rows, now).map((item) => item.id),
    ["sooner", "later", "filled", "expired"],
  );
});
