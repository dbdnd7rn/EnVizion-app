import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildCareTeamActivity,
  filterCareTeamActivity,
  summarizeCareTeamActivity,
} from "../src/careTeamActivityHelpers.ts";

const names = new Map([
  ["owner", "Primary Person"],
  ["member", "Family Person"],
]);

test("care team activity explains invitation accountability with actor and subject", () => {
  const items = buildCareTeamActivity(
    [
      {
        id: "c1",
        actorUserId: "owner",
        subjectUserId: "member",
        eventType: "invite_sent",
        role: "caregiver",
        note: null,
        createdAt: "2026-10-04T10:00:00.000Z",
      },
      {
        id: "c2",
        actorUserId: "member",
        subjectUserId: "member",
        eventType: "invite_accepted",
        role: "caregiver",
        note: null,
        createdAt: "2026-10-04T11:00:00.000Z",
      },
    ] as any,
    [],
    names,
  );

  assert.equal(items[0].title, "Invitation accepted");
  assert.match(items[1].detail, /Primary Person invited Family Person as Co-Caregiver/);
  assert.deepEqual(items[1].participantUserIds, ["owner", "member"]);
});

test("care team activity renders role changes with previous and current access", () => {
  const items = buildCareTeamActivity(
    [
      {
        id: "c1",
        actorUserId: "owner",
        subjectUserId: "member",
        eventType: "role_changed",
        role: "viewer",
        note: "Previous role: caregiver",
        createdAt: "2026-10-04T12:00:00.000Z",
      },
    ] as any,
    [],
    names,
  );

  assert.match(
    items[0].detail,
    /Primary Person changed Family Person from Co-Caregiver to Family Member/,
  );
});

test("care team activity combines access and workspace history newest first", () => {
  const items = buildCareTeamActivity(
    [
      {
        id: "c1",
        actorUserId: "owner",
        subjectUserId: "member",
        eventType: "access_revoked",
        role: "viewer",
        note: null,
        createdAt: "2026-10-04T10:00:00.000Z",
      },
    ] as any,
    [
      {
        id: "a1",
        actorUserId: "member",
        action: "workspace_opened",
        entityType: "care_workspace",
        entityId: "care",
        summary: "Care workspace opened",
        createdAt: "2026-10-04T13:00:00.000Z",
      },
    ] as any,
    names,
  );

  assert.deepEqual(
    items.map((item) => item.category),
    ["activity", "access"],
  );
});

test("care team activity filters by member and event category", () => {
  const items = buildCareTeamActivity(
    [
      {
        id: "c1",
        actorUserId: "owner",
        subjectUserId: "member",
        eventType: "invite_sent",
        role: "viewer",
        note: null,
        createdAt: "2026-10-04T10:00:00.000Z",
      },
    ] as any,
    [
      {
        id: "a1",
        actorUserId: "owner",
        action: "workspace_opened",
        entityType: "care_workspace",
        entityId: "care",
        summary: null,
        createdAt: "2026-10-04T11:00:00.000Z",
      },
    ] as any,
    names,
  );

  assert.equal(filterCareTeamActivity(items, "access", "member").length, 1);
  assert.equal(filterCareTeamActivity(items, "activity", "member").length, 0);
  assert.equal(filterCareTeamActivity(items, "all", "owner").length, 2);
});

test("care team activity summary counts accountability milestones", () => {
  const items = buildCareTeamActivity(
    [
      {
        id: "1",
        actorUserId: "owner",
        subjectUserId: "member",
        eventType: "invite_sent",
        role: "viewer",
        note: null,
        createdAt: "2026-10-04T08:00:00.000Z",
      },
      {
        id: "2",
        actorUserId: "member",
        subjectUserId: "member",
        eventType: "invite_accepted",
        role: "viewer",
        note: null,
        createdAt: "2026-10-04T09:00:00.000Z",
      },
      {
        id: "3",
        actorUserId: "owner",
        subjectUserId: "member",
        eventType: "role_changed",
        role: "caregiver",
        note: "Previous role: viewer",
        createdAt: "2026-10-04T10:00:00.000Z",
      },
      {
        id: "4",
        actorUserId: "owner",
        subjectUserId: "member",
        eventType: "access_revoked",
        role: "caregiver",
        note: null,
        createdAt: "2026-10-04T11:00:00.000Z",
      },
    ] as any,
    [],
    names,
  );

  assert.deepEqual(summarizeCareTeamActivity(items), {
    invitations: 1,
    accepted: 1,
    roleChanges: 1,
    revoked: 1,
  });
});
