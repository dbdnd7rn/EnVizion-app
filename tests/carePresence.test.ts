import { test } from "node:test";
import assert from "node:assert/strict";
import {
  presenceIsLive,
  presenceModeLabel,
  presenceScreenLabel,
  type CareWorkspacePresence,
} from "../src/carePresence.ts";

function row(lastSeenAt: string): CareWorkspacePresence {
  return {
    careRecipientId: "care-1",
    userId: "user-1",
    mode: "workspace",
    screenKey: "care_workspace",
    sessionId: null,
    connectedAt: "2026-09-23T08:00:00.000Z",
    lastSeenAt,
  };
}

test("presence is live inside the freshness window", () => {
  const now = new Date("2026-09-23T08:02:00.000Z");
  assert.equal(
    presenceIsLive(row("2026-09-23T08:00:30.000Z"), now),
    true,
  );
});

test("presence ages out when heartbeat is stale", () => {
  const now = new Date("2026-09-23T08:03:30.000Z");
  assert.equal(
    presenceIsLive(row("2026-09-23T08:00:30.000Z"), now),
    false,
  );
});

test("presence labels distinguish live coordination modes", () => {
  assert.equal(presenceModeLabel("workspace"), "In EnVizion");
  assert.equal(presenceModeLabel("on_shift"), "On shift");
  assert.equal(presenceModeLabel("handoff_review"), "Reviewing handoff");
  assert.equal(presenceModeLabel("coordination"), "Coordinating care");
});

test("presence screen labels are human readable", () => {
  assert.equal(presenceScreenLabel("on_shift"), "On-shift caregiver");
  assert.equal(presenceScreenLabel("continuity"), "Continuity timeline");
  assert.equal(presenceScreenLabel("unknown"), "Care workspace");
});
