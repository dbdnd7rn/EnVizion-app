import type {
  CareAccessReportPeriod,
  CareTeamMember,
  ConsentEvent,
} from "./careTeam";
import {
  buildCareTeamActivity,
  summarizeCareTeamActivity,
} from "./careTeamActivityHelpers.ts";

export const careAccessReportPeriodLabels: Record<
  CareAccessReportPeriod,
  string
> = {
  last_7_days: "Last 7 days",
  last_30_days: "Last 30 days",
  last_90_days: "Last 90 days",
  all_recorded_history: "All recorded history",
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formattedDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString()
    : "Date unavailable";
}

function roleLabel(role: CareTeamMember["role"]) {
  if (role === "owner") return "Primary Advocate";
  if (role === "caregiver") return "Co-Caregiver";
  if (role === "patient") return "Care Recipient";
  return "Family Member";
}

function statusLabel(member: CareTeamMember) {
  if (member.status === "active") return "Active";
  if (member.status === "declined") return "Declined";
  if (member.status === "revoked") return "Revoked";
  if (member.isExpired) return "Expired";
  return "Invited";
}

function currentRoleRows(members: CareTeamMember[]) {
  return members
    .map(
      (member) => `
        <tr>
          <td>${escapeHtml(member.displayName || "Care team member")}</td>
          <td>${escapeHtml(roleLabel(member.role))}</td>
          <td>${escapeHtml(statusLabel(member))}</td>
          <td>${escapeHtml(formattedDate(member.acceptedAt))}</td>
          <td>${escapeHtml(formattedDate(member.revokedAt))}</td>
        </tr>
      `,
    )
    .join("");
}

export type CareAccessReportBuildInput = {
  careRecipientName: string;
  generatedAt: string;
  period: CareAccessReportPeriod;
  members: CareTeamMember[];
  events: ConsentEvent[];
};

export function careAccessReportSummary(input: CareAccessReportBuildInput) {
  const names = new Map(
    input.members.map((member) => [member.userId, member.displayName]),
  );
  const activity = buildCareTeamActivity(input.events, [], names);
  const milestone = summarizeCareTeamActivity(activity);

  return {
    ...milestone,
    totalEvents: activity.length,
    activeMembers: input.members.filter(
      (member) => member.status === "active",
    ).length,
    pendingMembers: input.members.filter(
      (member) => member.status === "invited" && !member.isExpired,
    ).length,
    expiredMembers: input.members.filter(
      (member) => member.status === "invited" && member.isExpired,
    ).length,
  };
}

export function buildCareAccessReportHtml(
  input: CareAccessReportBuildInput,
) {
  const names = new Map(
    input.members.map((member) => [member.userId, member.displayName]),
  );
  const activity = buildCareTeamActivity(input.events, [], names);
  const summary = careAccessReportSummary(input);
  const periodLabel = careAccessReportPeriodLabels[input.period];

  const timeline = activity.length
    ? activity
        .map(
          (item) => `
            <article class="event">
              <div class="event-head">
                <strong>${escapeHtml(item.title)}</strong>
                <span>${escapeHtml(formattedDate(item.createdAt))}</span>
              </div>
              <p>${escapeHtml(item.detail)}</p>
            </article>
          `,
        )
        .join("")
    : '<p class="muted">No recorded care-access events fall within this report period.</p>';

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Care Team Access Report</title>
<style>
  @page { margin: 18mm 16mm; }
  body {
    font-family: Arial, sans-serif;
    color: #2f2434;
    font-size: 12px;
    line-height: 1.45;
  }
  header {
    border-bottom: 3px solid #75418b;
    padding-bottom: 13px;
    margin-bottom: 18px;
  }
  .brand {
    font-size: 10px;
    letter-spacing: 1.5px;
    color: #75418b;
    font-weight: 700;
  }
  h1 {
    font-size: 25px;
    color: #3f2949;
    margin: 7px 0 4px;
  }
  h2 {
    font-size: 16px;
    color: #75418b;
    margin: 18px 0 8px;
  }
  p { margin: 4px 0; }
  .meta, .muted {
    color: #6d6272;
    font-size: 10.5px;
  }
  .summary {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin: 14px 0 18px;
  }
  .summary div {
    border: 1px solid #e1d7e5;
    border-radius: 8px;
    padding: 8px;
  }
  .summary strong {
    display: block;
    font-size: 18px;
    color: #3f2949;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 7px;
  }
  th, td {
    border-bottom: 1px solid #e6dde9;
    text-align: left;
    vertical-align: top;
    padding: 7px 5px;
  }
  th {
    color: #75418b;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: .4px;
  }
  .event {
    border-left: 3px solid #ded0e5;
    padding: 3px 0 6px 10px;
    margin-bottom: 10px;
    break-inside: avoid;
  }
  .event-head {
    display: flex;
    justify-content: space-between;
    gap: 14px;
  }
  .event-head span {
    color: #6d6272;
    font-size: 10px;
    white-space: nowrap;
  }
  .notice {
    background: #faf7fb;
    border: 1px solid #e6dce9;
    border-radius: 8px;
    padding: 10px;
    margin: 16px 0;
  }
  footer {
    margin-top: 24px;
    border-top: 1px solid #ddd4e1;
    padding-top: 9px;
    color: #6d6272;
    font-size: 9.5px;
  }
</style>
</head>
<body>
<header>
  <div class="brand">ENVIZION LIFE · CARE TEAM ACCOUNTABILITY</div>
  <h1>Care Team Access Report</h1>
  <div class="meta">
    ${escapeHtml(input.careRecipientName || "Care profile")} ·
    ${escapeHtml(periodLabel)} ·
    Generated ${escapeHtml(formattedDate(input.generatedAt))}
  </div>
</header>

<div class="notice">
  This report contains care-team access and sharing history only. It intentionally excludes medications, diagnoses, observations, documents, appointment notes, and other clinical details.
</div>

<div class="summary">
  <div><strong>${summary.activeMembers}</strong><span>Active members</span></div>
  <div><strong>${summary.invitations}</strong><span>Invitations / re-opened</span></div>
  <div><strong>${summary.roleChanges}</strong><span>Role changes</span></div>
  <div><strong>${summary.revoked}</strong><span>Revocations</span></div>
</div>

<h2>Current care-team access</h2>
<table>
  <thead>
    <tr>
      <th>Team member</th>
      <th>Current role</th>
      <th>Status</th>
      <th>Accepted</th>
      <th>Revoked</th>
    </tr>
  </thead>
  <tbody>
    ${currentRoleRows(input.members)}
  </tbody>
</table>

<h2>Recorded access history · ${escapeHtml(periodLabel)}</h2>
${timeline}

<footer>
  EnVizion Life access accountability report. This document reflects recorded application access events and current care-team roles available to the Primary Advocate at generation time. It is not a clinical medical record and is not a complete device, network, identity-provider, or forensic access log.
</footer>
</body>
</html>`;
}
