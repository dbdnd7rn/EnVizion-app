import type {
  AccessGovernanceDashboard,
  AccessGovernanceQueueItem,
} from "./accessGovernanceAdmin";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString()
    : "Date unavailable";
}

function roleLabel(role: "caregiver" | "viewer") {
  return role === "caregiver" ? "Co-Caregiver" : "Family Member";
}

function bucketLabel(bucket: AccessGovernanceQueueItem["bucket"]) {
  if (bucket === "overdue_14") return "Overdue 14+ days";
  if (bucket === "overdue_7") return "Overdue 7+ days";
  if (bucket === "due") return "Due now";
  if (bucket === "upcoming_7") return "Due within 7 days";
  return "Scheduled";
}

function decisionLabel(
  value: AccessGovernanceDashboard["recentCompleted"][number]["decision"],
) {
  if (value === "keep") return "Kept access";
  if (value === "change_role") return "Changed role";
  if (value === "revoke") return "Revoked access";
  return "Completed";
}

export function buildAccessGovernanceReportHtml(
  dashboard: AccessGovernanceDashboard,
) {
  const queueRows = dashboard.queue.length
    ? dashboard.queue
        .map(
          (item) => `
            <tr>
              <td>${escapeHtml(item.memberName)}</td>
              <td>${escapeHtml(roleLabel(item.role))}</td>
              <td>${escapeHtml(item.careRecipientName)}</td>
              <td>${escapeHtml(item.primaryAdvocateName)}</td>
              <td>${escapeHtml(bucketLabel(item.bucket))}</td>
              <td>${escapeHtml(formatDate(item.dueAt))}</td>
            </tr>
          `,
        )
        .join("")
    : '<tr><td colspan="6" class="muted">No open access reviews are recorded.</td></tr>';

  const gapRows = dashboard.coverageGaps.length
    ? dashboard.coverageGaps
        .map(
          (item) => `
            <tr>
              <td>${escapeHtml(item.memberName)}</td>
              <td>${escapeHtml(roleLabel(item.role))}</td>
              <td>${escapeHtml(item.careRecipientName)}</td>
              <td>${escapeHtml(item.primaryAdvocateName)}</td>
            </tr>
          `,
        )
        .join("")
    : '<tr><td colspan="4" class="muted">No recertification coverage gaps are recorded.</td></tr>';

  const completedRows = dashboard.recentCompleted.length
    ? dashboard.recentCompleted
        .map(
          (item) => `
            <tr>
              <td>${escapeHtml(item.memberName)}</td>
              <td>${escapeHtml(item.careRecipientName)}</td>
              <td>${escapeHtml(decisionLabel(item.decision))}</td>
              <td>${escapeHtml(
                item.roleAfter ? roleLabel(item.roleAfter) : roleLabel(item.roleBefore),
              )}</td>
              <td>${escapeHtml(item.reviewedByName)}</td>
              <td>${escapeHtml(formatDate(item.reviewedAt))}</td>
            </tr>
          `,
        )
        .join("")
    : '<tr><td colspan="6" class="muted">No Primary Advocate sign-offs were recorded in the last 90 days.</td></tr>';

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Access Governance Evidence Report</title>
<style>
  @page { margin: 17mm 15mm; }
  body {
    font-family: Arial, sans-serif;
    color: #2f2434;
    font-size: 11px;
    line-height: 1.45;
  }
  header {
    border-bottom: 3px solid #75418b;
    padding-bottom: 12px;
    margin-bottom: 16px;
  }
  .brand {
    color: #75418b;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1.4px;
  }
  h1 {
    font-size: 24px;
    color: #3f2949;
    margin: 6px 0 3px;
  }
  h2 {
    color: #75418b;
    font-size: 15px;
    margin: 18px 0 7px;
  }
  .muted { color: #736878; }
  .notice {
    background: #faf7fb;
    border: 1px solid #e5dbe8;
    border-radius: 8px;
    padding: 9px;
    margin-bottom: 14px;
  }
  .summary {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 7px;
    margin: 12px 0 16px;
  }
  .summary div {
    border: 1px solid #e2d7e6;
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
    margin-top: 6px;
  }
  th, td {
    text-align: left;
    vertical-align: top;
    padding: 6px 5px;
    border-bottom: 1px solid #e8e0ea;
  }
  th {
    color: #75418b;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: .35px;
  }
  footer {
    border-top: 1px solid #ded5e1;
    margin-top: 22px;
    padding-top: 8px;
    color: #736878;
    font-size: 9px;
  }
</style>
</head>
<body>
<header>
  <div class="brand">ENVIZION LIFE · ACCESS GOVERNANCE</div>
  <h1>Access Governance Evidence Report</h1>
  <div class="muted">Snapshot generated ${escapeHtml(formatDate(dashboard.generatedAt))}</div>
</header>

<div class="notice">
  This report contains care-team access-governance metadata only. It intentionally excludes medications, diagnoses, observations, visit notes, documents and other clinical care content.
</div>

<div class="summary">
  <div><strong>${dashboard.summary.eligibleAccess}</strong><span>Eligible access records</span></div>
  <div><strong>${dashboard.summary.openReviews}</strong><span>Open reviews</span></div>
  <div><strong>${dashboard.summary.coverageGaps}</strong><span>Coverage gaps</span></div>
  <div><strong>${dashboard.summary.completed90Days}</strong><span>Completed in 90 days</span></div>
</div>

<div class="summary">
  <div><strong>${dashboard.summary.overdue14}</strong><span>Overdue 14+ days</span></div>
  <div><strong>${dashboard.summary.overdue7}</strong><span>Overdue 7+ days</span></div>
  <div><strong>${dashboard.summary.due}</strong><span>Due now</span></div>
  <div><strong>${dashboard.summary.upcoming7}</strong><span>Due within 7 days</span></div>
</div>

<h2>Open access review queue</h2>
<table>
  <thead>
    <tr>
      <th>Team member</th>
      <th>Role</th>
      <th>Care profile</th>
      <th>Primary Advocate</th>
      <th>Status</th>
      <th>Due</th>
    </tr>
  </thead>
  <tbody>${queueRows}</tbody>
</table>

<h2>Recertification coverage gaps</h2>
<table>
  <thead>
    <tr>
      <th>Team member</th>
      <th>Role</th>
      <th>Care profile</th>
      <th>Primary Advocate</th>
    </tr>
  </thead>
  <tbody>${gapRows}</tbody>
</table>

<h2>Recent Primary Advocate sign-offs</h2>
<table>
  <thead>
    <tr>
      <th>Team member</th>
      <th>Care profile</th>
      <th>Decision</th>
      <th>Resulting role</th>
      <th>Reviewed by</th>
      <th>Reviewed</th>
    </tr>
  </thead>
  <tbody>${completedRows}</tbody>
</table>

<h2>Governance policy</h2>
<p>
  Access is recertified every ${dashboard.policy.cadenceDays} days.
  Upcoming attention begins ${dashboard.policy.upcomingWindowDays} days before due date.
  Overdue escalation occurs at ${dashboard.policy.overdueEscalationDays.join(" and ")} days.
</p>
<p class="muted">${escapeHtml(dashboard.policy.scope)}</p>

<footer>
  EnVizion Life administrative access-governance evidence. This report is an operational oversight snapshot, not a clinical medical record and not a complete identity-provider, device or forensic security audit.
</footer>
</body>
</html>`;
}
