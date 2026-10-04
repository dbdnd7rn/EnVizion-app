import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildCareAccessReportHtml,
  careAccessReportSummary,
} from "../src/careTeamAccessReportHelpers.ts";

const members = [
  {
    userId: "owner",
    displayName: "Primary <Advocate>",
    email: "hidden@example.com",
    role: "owner",
    status: "active",
    invitedAt: null,
    acceptedAt: "2026-10-01T10:00:00.000Z",
    revokedAt: null,
    inviteExpiresAt: null,
    lastRemindedAt: null,
    emailRequestedAt: null,
    isExpired: false,
    isCurrentUser: true,
  },
  {
    userId: "member",
    displayName: "Family Person",
    email: "private@example.com",
    role: "viewer",
    status: "active",
    invitedAt: "2026-10-02T10:00:00.000Z",
    acceptedAt: "2026-10-02T11:00:00.000Z",
    revokedAt: null,
    inviteExpiresAt: null,
    lastRemindedAt: null,
    emailRequestedAt: null,
    isExpired: false,
    isCurrentUser: false,
  },
] as any;

const events = [
  {
    id: "e1",
    actorUserId: "owner",
    subjectUserId: "member",
    eventType: "invite_sent",
    role: "viewer",
    note: null,
    createdAt: "2026-10-02T10:00:00.000Z",
  },
  {
    id: "e2",
    actorUserId: "member",
    subjectUserId: "member",
    eventType: "invite_accepted",
    role: "viewer",
    note: null,
    createdAt: "2026-10-02T11:00:00.000Z",
  },
] as any;

test("care access report contains access accountability but no clinical fields", () => {
  const html = buildCareAccessReportHtml({
    careRecipientName: "Care Profile",
    generatedAt: "2026-10-04T12:00:00.000Z",
    period: "last_30_days",
    members,
    events,
  });

  assert.match(html, /Care Team Access Report/);
  assert.match(html, /Last 30 days/);
  assert.match(html, /Current care-team access/);
  assert.match(html, /Invitation sent/);
  assert.match(html, /Invitation accepted/);
  assert.match(html, /intentionally excludes medications, diagnoses, observations/i);
  assert.doesNotMatch(html, /hidden@example\.com/);
  assert.doesNotMatch(html, /private@example\.com/);
});

test("care access report escapes member names", () => {
  const html = buildCareAccessReportHtml({
    careRecipientName: "Care Profile",
    generatedAt: "2026-10-04T12:00:00.000Z",
    period: "last_30_days",
    members,
    events,
  });

  assert.match(html, /Primary &lt;Advocate&gt;/);
  assert.doesNotMatch(html, /Primary <Advocate>/);
});

test("care access report summary keeps access milestones explicit", () => {
  const summary = careAccessReportSummary({
    careRecipientName: "Care Profile",
    generatedAt: "2026-10-04T12:00:00.000Z",
    period: "last_30_days",
    members,
    events,
  });

  assert.equal(summary.activeMembers, 2);
  assert.equal(summary.invitations, 1);
  assert.equal(summary.accepted, 1);
  assert.equal(summary.totalEvents, 2);
});
