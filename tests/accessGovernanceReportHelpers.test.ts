import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAccessGovernanceReportHtml } from "../src/accessGovernanceReportHelpers.ts";

const dashboard = {
  generatedAt: "2026-10-04T15:00:00.000Z",
  summary: {
    status: "attention",
    eligibleAccess: 4,
    openReviews: 2,
    coverageGaps: 1,
    completed90Days: 1,
    overdue14: 0,
    overdue7: 1,
    due: 1,
    upcoming7: 0,
    scheduled: 0,
  },
  queue: [
    {
      id: "r1",
      careRecipientId: "care-1",
      careRecipientName: "Care <Profile>",
      primaryAdvocateName: "Primary Advocate",
      subjectUserId: "member-1",
      memberName: "Co <Caregiver>",
      role: "caregiver",
      status: "due",
      bucket: "overdue_7",
      dueAt: "2026-10-01T10:00:00.000Z",
      daysToDue: -3,
      overdueDays: 3,
      advanceNotifiedAt: null,
      overdue7NotifiedAt: "2026-10-03T10:00:00.000Z",
      overdue14NotifiedAt: null,
    },
  ],
  coverageGaps: [
    {
      careRecipientId: "care-2",
      careRecipientName: "Second Profile",
      primaryAdvocateName: "Other Advocate",
      subjectUserId: "member-2",
      memberName: "Family Person",
      role: "viewer",
    },
  ],
  recentCompleted: [
    {
      id: "done-1",
      careRecipientId: "care-1",
      careRecipientName: "Care <Profile>",
      subjectUserId: "member-3",
      memberName: "Reviewed Person",
      roleBefore: "viewer",
      decision: "keep",
      roleAfter: "viewer",
      reviewedByName: "Primary Advocate",
      reviewedAt: "2026-09-30T10:00:00.000Z",
    },
  ],
  policy: {
    cadenceDays: 90,
    upcomingWindowDays: 7,
    overdueEscalationDays: [7, 14],
    scope: "Access-governance metadata only. Clinical care records are not included.",
  },
} as any;

test("access governance report includes oversight evidence and policy", () => {
  const html = buildAccessGovernanceReportHtml(dashboard);

  assert.match(html, /Access Governance Evidence Report/);
  assert.match(html, /Open access review queue/);
  assert.match(html, /Recertification coverage gaps/);
  assert.match(html, /Recent Primary Advocate sign-offs/);
  assert.match(html, /Access is recertified every 90 days/);
  assert.match(html, /Overdue 7\+ days/);
});

test("access governance report is privacy minimized", () => {
  const html = buildAccessGovernanceReportHtml(dashboard);

  assert.match(
    html,
    /intentionally excludes medications, diagnoses, observations, visit notes, documents/i,
  );
  assert.doesNotMatch(html, /email@example\.com/);
  assert.doesNotMatch(html, /medication name/i);
});

test("access governance report escapes names and care-profile labels", () => {
  const html = buildAccessGovernanceReportHtml(dashboard);

  assert.match(html, /Care &lt;Profile&gt;/);
  assert.match(html, /Co &lt;Caregiver&gt;/);
  assert.doesNotMatch(html, /Care <Profile>/);
  assert.doesNotMatch(html, /Co <Caregiver>/);
});
