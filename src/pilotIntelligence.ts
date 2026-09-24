import { supabase } from "./supabase";

export type PilotFunnel = {
  enrolled: number;
  accountConfirmed: number;
  firstSignIn: number;
  documentsComplete: number;
  roleReady: number;
  activeLaunchReady: number;
  passedValidation: number;
  completed: number;
};

export type PilotDeviceMatrixItem = {
  platform: "ios" | "android" | "web";
  deviceClass: "phone" | "tablet" | "desktop";
  total: number;
  passed: number;
  failed: number;
  blocked: number;
  inProgress: number;
  passRate: number;
};

export type PilotFeedbackTrend = {
  category: string;
  total: number;
  open: number;
  closed: number;
  last30Days: number;
};

export type PilotWaveComparison = {
  id: string;
  name: string;
  cohort: string;
  status: string;
  requiredPlatforms: string[];
  testerCount: number;
  runs: number;
  passedRuns: number;
  failedRuns: number;
  blockedRuns: number;
  runPassRate: number;
  rolesCovered: string[];
  platformsCovered: string[];
  drills: number;
  passedDrills: number;
  signoffStatus: string | null;
  startsAt: string | null;
  endsAt: string | null;
};

export type PilotIntelligence = {
  generatedAt: string;
  funnel: PilotFunnel;
  deviceMatrix: PilotDeviceMatrixItem[];
  feedbackTrends: PilotFeedbackTrend[];
  waveComparisons: PilotWaveComparison[];
  outcomes: {
    completed: number;
    withdrawn: number;
    active: number;
    paused: number;
  };
  contentReadiness: {
    total: number;
    draft: number;
    published: number;
    retired: number;
  };
  launchGaps: string[];
};

async function invokePilotAdmin<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("pilot-admin", {
    body,
  });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

export async function loadPilotIntelligence(): Promise<PilotIntelligence> {
  const result = await invokePilotAdmin<{ intelligence: PilotIntelligence }>({
    action: "intelligence",
  });
  return result.intelligence;
}

export function pilotFunnelRate(value: number, enrolled: number) {
  if (enrolled <= 0) return 0;
  return Math.round((value / enrolled) * 100);
}

function esc(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function tableRow(cells: unknown[]) {
  return "<tr>" +
    cells.map((cell) => "<td>" + esc(cell) + "</td>").join("") +
    "</tr>";
}

export function pilotOutcomeReportHtml(data: PilotIntelligence) {
  const funnelRows = [
    ["Enrolled", data.funnel.enrolled],
    ["Account confirmed", data.funnel.accountConfirmed],
    ["First sign-in", data.funnel.firstSignIn],
    ["Documents complete", data.funnel.documentsComplete],
    ["Real care role ready", data.funnel.roleReady],
    ["Active + launch ready", data.funnel.activeLaunchReady],
    ["Passed validation", data.funnel.passedValidation],
    ["Pilot completed", data.funnel.completed],
  ]
    .map(([label, value]) =>
      tableRow([
        label,
        value,
        pilotFunnelRate(Number(value), data.funnel.enrolled) + "%",
      ]),
    )
    .join("");

  const deviceRows =
    data.deviceMatrix.length > 0
      ? data.deviceMatrix
          .map((item) =>
            tableRow([
              item.platform,
              item.deviceClass,
              item.total,
              item.passed,
              item.failed,
              item.blocked,
              item.passRate + "%",
            ]),
          )
          .join("")
      : tableRow(["No real device validation data", "", "", "", "", "", ""]);

  const feedbackRows =
    data.feedbackTrends.length > 0
      ? data.feedbackTrends
          .map((item) =>
            tableRow([
              item.category,
              item.total,
              item.open,
              item.closed,
              item.last30Days,
            ]),
          )
          .join("")
      : tableRow(["No pilot feedback submitted", "", "", "", ""]);

  const waveRows =
    data.waveComparisons.length > 0
      ? data.waveComparisons
          .map((item) =>
            tableRow([
              item.name,
              item.cohort,
              item.status,
              item.testerCount,
              item.runs,
              item.runPassRate + "%",
              item.drills,
              item.signoffStatus ?? "No sign-off",
            ]),
          )
          .join("")
      : tableRow(["No launch waves created", "", "", "", "", "", "", ""]);

  const gaps = data.launchGaps.length
    ? "<ul>" +
      data.launchGaps.map((gap) => "<li>" + esc(gap) + "</li>").join("") +
      "</ul>"
    : "<p>No unresolved system-reported launch gaps at report generation time.</p>";

  return [
    "<!doctype html><html><head><meta charset=\\"utf-8\\" />",
    "<title>EnVizion Life Pilot Outcome Report</title>",
    "<style>",
    "body{font-family:Arial,sans-serif;color:#2f2433;margin:36px;line-height:1.45}",
    "h1,h2{color:#512861}h1{margin-bottom:4px}",
    ".muted{color:#776c7b;font-size:12px}",
    ".notice{background:#f5eef7;padding:14px;border-radius:10px;margin:16px 0}",
    "table{border-collapse:collapse;width:100%;margin:12px 0 24px;font-size:12px}",
    "th,td{border:1px solid #ddd2e1;padding:8px;text-align:left;vertical-align:top}",
    "th{background:#f3ecf5}",
    ".summary{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0}",
    ".metric{border:1px solid #ddd2e1;padding:12px;min-width:120px;border-radius:10px}",
    ".metric strong{font-size:22px;display:block}",
    "</style></head><body>",
    "<h1>EnVizion Life Pilot Outcome Report</h1>",
    "<p class=\\"muted\\">Generated " + esc(new Date(data.generatedAt).toLocaleString()) + "</p>",
    "<div class=\\"notice\\">This report summarizes operational pilot evidence only. It is not a clinical-safety, regulatory, legal, or compliance certification and does not replace real clinical content approval, device testing, or launch sign-off.</div>",
    "<h2>Onboarding and validation funnel</h2>",
    "<table><thead><tr><th>Stage</th><th>Participants</th><th>% of enrolled</th></tr></thead><tbody>" + funnelRows + "</tbody></table>",
    "<h2>Outcome snapshot</h2>",
    "<div class=\\"summary\\">",
    "<div class=\\"metric\\"><strong>" + data.outcomes.completed + "</strong>Completed</div>",
    "<div class=\\"metric\\"><strong>" + data.outcomes.withdrawn + "</strong>Withdrawn</div>",
    "<div class=\\"metric\\"><strong>" + data.outcomes.active + "</strong>Active</div>",
    "<div class=\\"metric\\"><strong>" + data.outcomes.paused + "</strong>Paused</div>",
    "</div>",
    "<h2>Device and platform validation</h2>",
    "<table><thead><tr><th>Platform</th><th>Device</th><th>Runs</th><th>Passed</th><th>Failed</th><th>Blocked</th><th>Pass rate</th></tr></thead><tbody>" + deviceRows + "</tbody></table>",
    "<h2>Pilot feedback</h2>",
    "<table><thead><tr><th>Category</th><th>Total</th><th>Open</th><th>Closed</th><th>Last 30 days</th></tr></thead><tbody>" + feedbackRows + "</tbody></table>",
    "<h2>Launch-wave comparison</h2>",
    "<table><thead><tr><th>Wave</th><th>Cohort</th><th>Status</th><th>Testers</th><th>Runs</th><th>Run pass rate</th><th>Drills</th><th>Sign-off</th></tr></thead><tbody>" + waveRows + "</tbody></table>",
    "<h2>Clinical content readiness</h2>",
    "<p>" + data.contentReadiness.published + "/" + data.contentReadiness.total + " published · " +
      data.contentReadiness.draft + " draft · " + data.contentReadiness.retired + " retired.</p>",
    "<h2>Unresolved launch dependencies</h2>",
    gaps,
    "</body></html>",
  ].join("");
}
